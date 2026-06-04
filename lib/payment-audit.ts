export type PaymentAuditOrder = Record<string, unknown>;

const CONFIRMED_PAYMENT_STATUSES = new Set(['success', 'successful', 'paid', 'confirmed', 'captured', 'paid_cash']);
const ONLINE_CONFIRMED_PAYMENT_STATUSES = new Set(['success', 'successful', 'paid', 'confirmed', 'captured']);
const PENDING_PAYMENT_STATUSES = new Set(['pending', 'awaiting', 'checkout', 'unpaid', 'initiated', '']);
const CANCELLED_OR_FAILED_STATUSES = /cancel|cancelled|canceled|refund|refunded|failed|payment_failed|checkout_failed|abandoned|declined|void|voided/;

const FULFILLMENT_PROGRESS_STATUSES = new Set([
  'accepted',
  'confirmed',
  'confirmed_by_store',
  'booking_confirmed',
  'preparing',
  'processing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
  'in_transit',
  'delivered',
  'completed',
  'complete',
  'service_in_progress',
  'service_completed',
  'manual_completed',
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function normalizedPaymentStatus(order: PaymentAuditOrder) {
  const payment = record(order.payment);
  return clean(order.paymentStatus ?? order.payment_status ?? order.statusPayment ?? payment.status).toLowerCase().replace(/\s+/g, '_');
}

export function paymentMethodValue(order: PaymentAuditOrder) {
  const payment = record(order.payment);
  return clean(order.paymentMethod ?? order.payment_method ?? order.paymentCollectionMode ?? order.payment_collection_mode ?? payment.method).toLowerCase().replace(/\s+/g, '_');
}

export function paymentProviderValue(order: PaymentAuditOrder) {
  const payment = record(order.payment);
  return clean(order.paymentProvider ?? order.payment_provider ?? order.provider ?? payment.provider).toLowerCase().replace(/\s+/g, '_');
}

export function paymentReferenceValue(order: PaymentAuditOrder) {
  const payment = record(order.payment);
  return clean(
    order.paymentReference
      ?? order.payment_reference
      ?? order.reference
      ?? order.paystackReference
      ?? order.paystack_reference
      ?? order.transactionReference
      ?? order.transaction_reference
      ?? order.transactionId
      ?? order.transaction_id
      ?? payment.reference
      ?? payment.paymentReference
      ?? payment.transactionReference,
  );
}

export function isCashLikePayment(order: PaymentAuditOrder) {
  const combined = [
    paymentMethodValue(order),
    paymentProviderValue(order),
    clean(order.paymentCollectionMode ?? order.payment_collection_mode),
    clean(order.orderType ?? order.order_type),
    clean(order.recordType ?? order.record_type),
    clean(order.source ?? order.sourceChannel ?? order.source_channel),
  ].join(' ').toLowerCase();

  return /(^|[^a-z])cash([^a-z]|$)|manual_cash|quick_pay_cash|store_only/.test(combined) || order.storeOnly === true || order.store_only === true;
}

export function isOnlineCheckoutOrder(order: PaymentAuditOrder) {
  if (isCashLikePayment(order)) return false;
  const combined = [paymentMethodValue(order), paymentProviderValue(order), clean(order.checkoutStatus ?? order.checkout_status), clean(order.source ?? order.sourceChannel ?? order.source_channel)].join(' ').toLowerCase();
  return /paystack|online|checkout|card|mobile_money|momo|wallet|sedifex_pay|payment_link/.test(combined) || Boolean(paymentReferenceValue(order));
}

export function isCashConfirmed(order: PaymentAuditOrder) {
  return normalizedPaymentStatus(order) === 'paid_cash' || order.cashConfirmed === true || order.cash_confirmed === true;
}

export function isOnlinePaymentConfirmed(order: PaymentAuditOrder) {
  const status = normalizedPaymentStatus(order);
  if (!ONLINE_CONFIRMED_PAYMENT_STATUSES.has(status)) return false;
  if (isCashLikePayment(order)) return false;
  return Boolean(paymentReferenceValue(order));
}

export function isPaymentConfirmed(order: PaymentAuditOrder) {
  if (isCashConfirmed(order)) return true;
  if (isOnlinePaymentConfirmed(order)) return true;
  const status = normalizedPaymentStatus(order);
  return CONFIRMED_PAYMENT_STATUSES.has(status) && !isOnlineCheckoutOrder(order);
}

export function isPaymentPending(order: PaymentAuditOrder) {
  const status = normalizedPaymentStatus(order);
  return !isPaymentConfirmed(order) || PENDING_PAYMENT_STATUSES.has(status);
}

export function hasFulfillmentProgress(order: PaymentAuditOrder) {
  const statuses = [
    order.orderStatus,
    order.order_status,
    order.bookingStatus,
    order.booking_status,
    order.fulfillmentStatus,
    order.fulfillment_status,
    order.deliveryStatus,
    order.delivery_status,
    order.adminLastStatusAction,
  ].map((value) => clean(value).toLowerCase().replace(/\s+/g, '_'));

  return statuses.some((status) => FULFILLMENT_PROGRESS_STATUSES.has(status)) || Boolean(order.receivedAt || order.deliveredAt || order.completedAt);
}

export function isCancelledOrFailedOrder(order: PaymentAuditOrder) {
  const combined = [
    order.orderStatus,
    order.order_status,
    order.bookingStatus,
    order.booking_status,
    order.fulfillmentStatus,
    order.fulfillment_status,
    order.deliveryStatus,
    order.delivery_status,
    order.paymentStatus,
    order.payment_status,
    order.checkoutStatus,
    order.checkout_status,
  ].map((value) => clean(value).toLowerCase().replace(/\s+/g, '_')).join(' ');

  return CANCELLED_OR_FAILED_STATUSES.test(combined) || Boolean(order.cancelledAt || order.canceledAt || order.refundedAt || order.failedAt);
}

export function isAcceptedWithoutPayment(order: PaymentAuditOrder) {
  return !isCancelledOrFailedOrder(order) && hasFulfillmentProgress(order) && !isPaymentConfirmed(order);
}

export function paymentAuditLabel(order: PaymentAuditOrder) {
  if (isPaymentConfirmed(order)) return 'Payment confirmed';
  if (isAcceptedWithoutPayment(order)) return 'Payment not confirmed';
  return 'Payment pending';
}

export function settlementStatusForOrder(order: PaymentAuditOrder) {
  const existing = clean(order.settlementStatus ?? order.settlement_status);
  if (existing) return existing;
  if (isCashConfirmed(order) || order.storeOnly === true || order.store_only === true) return 'excluded_cash';
  if (isOnlinePaymentConfirmed(order)) return 'pending_settlement';
  return '';
}

export function paymentAuditPatch(order: PaymentAuditOrder, updatedAt: unknown) {
  const settlementStatus = settlementStatusForOrder(order);

  if (isCancelledOrFailedOrder(order) || !isPaymentPending(order)) {
    return settlementStatus ? { settlementStatus } : {};
  }

  return {
    paymentAuditStatus: 'payment_not_confirmed',
    paymentAuditSeverity: 'warning',
    paymentAuditReason: 'Order received but payment has not been confirmed.',
    paymentAuditUpdatedAt: updatedAt,
    requiresPaymentReview: true,
    ...(settlementStatus ? { settlementStatus } : {}),
  };
}
