import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

type StatusAction =
  | 'received'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'confirm_service'
  | 'service_in_progress'
  | 'service_completed'
  | 'complete_manual';

type StatusBody = {
  orderId?: unknown;
  storeId?: unknown;
  action?: unknown;
  note?: unknown;
};

const ACTION_LABELS: Record<StatusAction, string> = {
  received: 'Accepted by store',
  preparing: 'Preparing product',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  confirm_service: 'Service booking confirmed',
  service_in_progress: 'Service started',
  service_completed: 'Service completed',
  complete_manual: 'Manual entry completed',
};

function cookieValue(req: Request, name: string) {
  return req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split('=')[1];
}

function isAllowedRole(role?: string) {
  return role === 'super_admin' || role === 'ops_admin' || role === 'support';
}

function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isStatusAction(value: string): value is StatusAction {
  return value === 'received'
    || value === 'preparing'
    || value === 'out_for_delivery'
    || value === 'delivered'
    || value === 'confirm_service'
    || value === 'service_in_progress'
    || value === 'service_completed'
    || value === 'complete_manual';
}

function storeIdFromOrder(order: FirebaseFirestore.DocumentData | undefined, fallback = '') {
  if (!order) return fallback;
  return clean(order.storeId || order.store_id || order.merchantId || order.merchant_id || order.businessId || order.business_id) || fallback;
}

function statusPatch(action: StatusAction) {
  const now = Timestamp.now();
  const base: Record<string, unknown> = {
    adminLastStatusAction: action,
    adminLastStatusLabel: ACTION_LABELS[action],
    adminLastStatusUpdatedAt: now,
    statusUpdatedAt: now,
    updatedAt: now,
    updatedBy: 'sedifex_admin',
    updatedByRole: 'admin',
  };

  if (action === 'received') {
    return {
      ...base,
      orderStatus: 'confirmed_by_store',
      order_status: 'confirmed_by_store',
      fulfillmentStatus: 'accepted',
      fulfillment_status: 'accepted',
      deliveryStatus: 'not_started',
      delivery_status: 'not_started',
      receivedAt: now,
      receivedBy: 'sedifex_admin',
      storeConfirmedAt: now,
      storeConfirmedBy: 'sedifex_admin',
    };
  }

  if (action === 'preparing') {
    return {
      ...base,
      orderStatus: 'preparing',
      order_status: 'preparing',
      fulfillmentStatus: 'preparing',
      fulfillment_status: 'preparing',
      deliveryStatus: 'not_started',
      delivery_status: 'not_started',
      preparingAt: now,
      preparingBy: 'sedifex_admin',
    };
  }

  if (action === 'out_for_delivery') {
    return {
      ...base,
      orderStatus: 'out_for_delivery',
      order_status: 'out_for_delivery',
      fulfillmentStatus: 'out_for_delivery',
      fulfillment_status: 'out_for_delivery',
      deliveryStatus: 'out_for_delivery',
      delivery_status: 'out_for_delivery',
      outForDeliveryAt: now,
      outForDeliveryBy: 'sedifex_admin',
    };
  }

  if (action === 'delivered') {
    return {
      ...base,
      orderStatus: 'delivered',
      order_status: 'delivered',
      fulfillmentStatus: 'completed',
      fulfillment_status: 'completed',
      deliveryStatus: 'delivered',
      delivery_status: 'delivered',
      deliveredAt: now,
      deliveredBy: 'sedifex_admin',
      customerDeliveredEmailSent: false,
      customerDeliveryConfirmationStatus: 'pending',
    };
  }

  if (action === 'confirm_service') {
    return {
      ...base,
      orderStatus: 'booking_confirmed',
      order_status: 'booking_confirmed',
      bookingStatus: 'confirmed',
      fulfillmentStatus: 'booking_confirmed',
      fulfillment_status: 'booking_confirmed',
      deliveryStatus: 'not_applicable',
      delivery_status: 'not_applicable',
      serviceConfirmedAt: now,
      serviceConfirmedBy: 'sedifex_admin',
    };
  }

  if (action === 'service_in_progress') {
    return {
      ...base,
      orderStatus: 'service_in_progress',
      order_status: 'service_in_progress',
      bookingStatus: 'in_progress',
      fulfillmentStatus: 'service_in_progress',
      fulfillment_status: 'service_in_progress',
      deliveryStatus: 'not_applicable',
      delivery_status: 'not_applicable',
      serviceStartedAt: now,
      serviceStartedBy: 'sedifex_admin',
    };
  }

  if (action === 'service_completed') {
    return {
      ...base,
      orderStatus: 'service_completed',
      order_status: 'service_completed',
      bookingStatus: 'completed',
      fulfillmentStatus: 'completed',
      fulfillment_status: 'completed',
      deliveryStatus: 'not_applicable',
      delivery_status: 'not_applicable',
      completedAt: now,
      completedBy: 'sedifex_admin',
    };
  }

  return {
    ...base,
    orderStatus: 'manual_completed',
    order_status: 'manual_completed',
    fulfillmentStatus: 'completed',
    fulfillment_status: 'completed',
    deliveryStatus: 'not_applicable',
    delivery_status: 'not_applicable',
    completedAt: now,
    completedBy: 'sedifex_admin',
  };
}

export async function POST(req: Request) {
  const role = cookieValue(req, 'sedifex_admin_role');
  if (!isAllowedRole(role)) {
    return NextResponse.json({ ok: false, error: 'Only super_admin, ops_admin, or support can update order status.', currentRole: role || null }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null) as StatusBody | null;
    const orderId = clean(body?.orderId, 220);
    const requestedStoreId = clean(body?.storeId, 220);
    const action = clean(body?.action, 60);
    const note = clean(body?.note, 1000);

    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId is required.' }, { status: 400 });
    if (!isStatusAction(action)) return NextResponse.json({ ok: false, error: 'Unsupported status action.', action }, { status: 400 });

    const db = adminFirestore();
    const orderRef = db.collection('integrationOrders').doc(orderId);
    const orderSnapshot = await orderRef.get();
    const orderData = orderSnapshot.exists ? orderSnapshot.data() : undefined;
    const storeId = storeIdFromOrder(orderData, requestedStoreId);
    const patch = statusPatch(action);
    const historyEntry = {
      status: action,
      label: ACTION_LABELS[action],
      actor: 'sedifex_admin',
      actorRole: role,
      source: 'sedifexadmin',
      note: note || null,
      createdAt: Timestamp.now(),
      createdAtIso: new Date().toISOString(),
    };

    const update = {
      ...patch,
      statusHistory: FieldValue.arrayUnion(historyEntry),
    };

    const batch = db.batch();
    batch.set(orderRef, update, { merge: true });

    const updatedPaths = [`integrationOrders/${orderId}`];
    if (storeId) {
      const storeOrderRef = db.collection('stores').doc(storeId).collection('integrationOrders').doc(orderId);
      batch.set(storeOrderRef, update, { merge: true });
      updatedPaths.push(`stores/${storeId}/integrationOrders/${orderId}`);
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      orderId,
      storeId: storeId || null,
      action,
      label: ACTION_LABELS[action],
      updatedPaths,
      patch: {
        orderStatus: patch.orderStatus,
        fulfillmentStatus: patch.fulfillmentStatus,
        deliveryStatus: patch.deliveryStatus,
      },
    });
  } catch (error) {
    console.error('[integration-order-status] failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to update order status.' }, { status: 500 });
  }
}
