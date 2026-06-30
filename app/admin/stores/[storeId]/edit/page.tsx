import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Store } from 'lucide-react';
import { SectionCard, StatusBadge } from '../../../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus, getFirestoreDocument } from '../../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = Promise<{ storeId: string }>;
type StoreRecord = Record<string, unknown> & { id?: string; path?: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return fallback;
}

function fieldText(record: StoreRecord | null | undefined, fields: string[], fallback = '') {
  if (!record) return fallback;
  for (const field of fields) {
    const value = text(record[field], '');
    if (value) return value;
  }
  return fallback;
}

function nestedText(record: StoreRecord | null | undefined, path: string[], fallback = '') {
  let current: unknown = record;
  for (const key of path) {
    current = asRecord(current)[key];
  }
  return text(current, fallback);
}

function formText(formData: FormData, key: string) {
  return text(formData.get(key));
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function dateInputValue(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const isoDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoDate) return isoDate;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  const seconds = asRecord(value).seconds;
  if (typeof seconds === 'number') {
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  return '';
}

function dateFormValue(formData: FormData, key: string) {
  return optionalText(formText(formData, key));
}

async function loadStore(storeId: string) {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { error: 'Firebase environment variables are not ready.', profile: null, settings: null };

  const [profile, settings] = await Promise.all([
    getFirestoreDocument(`stores/${storeId}`).catch(() => null),
    getFirestoreDocument(`storeSettings/${storeId}`).catch(() => null),
  ]);

  return {
    error: !profile && !settings ? 'Store not found in /stores or /storeSettings.' : null,
    profile: profile as StoreRecord | null,
    settings: settings as StoreRecord | null,
  };
}

async function updateStore(formData: FormData) {
  'use server';

  const storeId = formText(formData, 'storeId');
  if (!storeId) return;

  const now = new Date().toISOString();
  const displayName = formText(formData, 'displayName');
  const publicEmail = formText(formData, 'publicEmail');
  const phone = formText(formData, 'phone');
  const addressLine1 = formText(formData, 'addressLine1');
  const city = formText(formData, 'city');
  const country = formText(formData, 'country') || 'Ghana';
  const websiteUrl = formText(formData, 'websiteUrl');
  const hubtelApprovedSenderId = formText(formData, 'hubtelApprovedSenderId');
  const instagramHandle = formText(formData, 'instagramHandle');
  const tiktokHandle = formText(formData, 'tiktokHandle');
  const whatsappNumber = formText(formData, 'whatsappNumber');
  const eligibleForBuy = checked(formData, 'eligibleForBuy');
  const buyOptOut = checked(formData, 'buyOptOut');
  const status = formText(formData, 'status') || 'active';
  const paymentStatus = formText(formData, 'paymentStatus') || status;
  const paymentProvider = formText(formData, 'paymentProvider');
  const planKey = formText(formData, 'planKey');
  const contractStatus = formText(formData, 'contractStatus');
  const contractStart = dateFormValue(formData, 'contractStart');
  const contractEnd = dateFormValue(formData, 'contractEnd');
  const lastPaymentAt = dateFormValue(formData, 'lastPaymentAt');
  const paystackCustomerCode = formText(formData, 'paystackCustomerCode');
  const workspaceId = formText(formData, 'workspaceId');
  const workspaceName = formText(formData, 'workspaceName');
  const workspaceStatus = formText(formData, 'workspaceStatus');
  const workspaceRole = formText(formData, 'workspaceRole');

  const profilePayload = {
    displayName,
    name: displayName,
    storeName: displayName,
    publicEmail,
    email: publicEmail,
    ownerEmail: publicEmail,
    phone,
    phoneNumber: phone,
    contactPhone: phone,
    publicPhone: phone,
    storePhone: phone,
    addressLine1,
    city,
    country,
    storeCity: city,
    storeCountry: country,
    websiteUrl: optionalText(websiteUrl),
    websiteLink: optionalText(websiteUrl),
    storeWebsiteUrl: optionalText(websiteUrl),
    hubtelApprovedSenderId: optionalText(hubtelApprovedSenderId),
    instagramHandle: optionalText(instagramHandle),
    tiktokHandle: optionalText(tiktokHandle),
    whatsappNumber: optionalText(whatsappNumber),
    eligibleForBuy,
    buyOptOut,
    status,
    paymentStatus,
    paymentProvider: optionalText(paymentProvider),
    contractStatus: optionalText(contractStatus),
    contractStart,
    contractEnd,
    workspaceId: optionalText(workspaceId),
    workspaceName: optionalText(workspaceName),
    workspaceStatus: optionalText(workspaceStatus),
    workspaceRole: optionalText(workspaceRole),
    workspace: {
      id: optionalText(workspaceId),
      name: optionalText(workspaceName),
      status: optionalText(workspaceStatus),
      role: optionalText(workspaceRole),
      updatedAt: now,
    },
    billing: {
      provider: optionalText(paymentProvider),
      planKey: optionalText(planKey),
      contractStatus: optionalText(contractStatus),
      contractStart,
      currentPeriodStart: contractStart,
      contractEnd,
      currentPeriodEnd: contractEnd,
      lastPaymentAt,
      paystackCustomerCode: optionalText(paystackCustomerCode),
      updatedAt: now,
    },
    publicProfile: {
      displayName,
      publicEmail,
      publicPhone: phone,
      addressLine1,
      city,
      country,
      websiteUrl: optionalText(websiteUrl),
      instagramHandle: optionalText(instagramHandle),
      tiktokHandle: optionalText(tiktokHandle),
      whatsappNumber: optionalText(whatsappNumber),
      updatedAt: now,
    },
    socialLinks: {
      displayName,
      publicEmail,
      publicPhone: phone,
      addressLine1,
      city,
      country,
      websiteUrl: optionalText(websiteUrl),
      instagramHandle: optionalText(instagramHandle),
      tiktokHandle: optionalText(tiktokHandle),
      whatsappNumber: optionalText(whatsappNumber),
      updatedAt: now,
    },
    updatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-store-edit',
  };

  const settingsPayload = {
    displayName,
    name: displayName,
    storeName: displayName,
    publicEmail,
    email: publicEmail,
    ownerEmail: publicEmail,
    phone,
    contactPhone: phone,
    publicPhone: phone,
    addressLine1,
    city,
    country,
    websiteUrl: optionalText(websiteUrl),
    websiteLink: optionalText(websiteUrl),
    eligibleForBuy,
    buyOptOut,
    status,
    paymentStatus,
    paymentProvider: optionalText(paymentProvider),
    contractStatus: optionalText(contractStatus),
    contractStart,
    contractEnd,
    workspaceId: optionalText(workspaceId),
    workspaceName: optionalText(workspaceName),
    workspaceStatus: optionalText(workspaceStatus),
    workspaceRole: optionalText(workspaceRole),
    workspace: {
      id: optionalText(workspaceId),
      name: optionalText(workspaceName),
      status: optionalText(workspaceStatus),
      role: optionalText(workspaceRole),
      updatedAt: now,
    },
    billing: {
      provider: optionalText(paymentProvider),
      planKey: optionalText(planKey),
      contractStatus: optionalText(contractStatus),
      contractStart,
      currentPeriodStart: contractStart,
      contractEnd,
      currentPeriodEnd: contractEnd,
      lastPaymentAt,
      paystackCustomerCode: optionalText(paystackCustomerCode),
      updatedAt: now,
    },
    updatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-store-edit',
  };

  const db = adminFirestore();
  await Promise.all([
    db.collection('stores').doc(storeId).set(profilePayload, { merge: true }),
    db.collection('storeSettings').doc(storeId).set(settingsPayload, { merge: true }),
    db.collection('adminAuditLogs').add({
      action: 'store_profile_edit',
      storeId,
      displayName,
      actor: 'sedifexadmin',
      createdAt: now,
    }),
  ]);

  redirect(`/admin/stores/${encodeURIComponent(storeId)}`);
}

function Field({ label, name, defaultValue, placeholder, type = 'text' }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue || ''}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue || options[0]}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default async function EditStorePage({ params }: { params: Params }) {
  const { storeId } = await params;
  const decodedStoreId = decodeURIComponent(storeId);
  const data = await loadStore(decodedStoreId);
  const identity = { ...(data.settings || {}), ...(data.profile || {}) } as StoreRecord;
  const displayName = fieldText(identity, ['displayName', 'storeName', 'name', 'businessName'], decodedStoreId);

  if (data.error) {
    return (
      <div className="space-y-6">
        <Link href="/admin/stores" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          <ArrowLeft className="h-4 w-4" /> Back to stores
        </Link>
        <SectionCard title="Store not found"><p className="text-sm text-slate-600">{data.error}</p></SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/stores/${encodeURIComponent(decodedStoreId)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          <ArrowLeft className="h-4 w-4" /> Back to store details
        </Link>
        <StatusBadge tone="blue">Editing merged store profile</StatusBadge>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
          <Store className="h-4 w-4" /> Edit store
        </div>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{displayName}</h2>
        <p className="mt-2 break-all text-sm text-slate-300">Store ID: {decodedStoreId}</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          This form updates the common public fields in both /stores and /storeSettings so the admin list, marketplace profile, and integrations can use the same clean store name and contact data.
        </p>
      </section>

      <form action={updateStore} className="space-y-6">
        <input type="hidden" name="storeId" value={decodedStoreId} />

        <SectionCard title="Main store information">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Store name" name="displayName" defaultValue={displayName} placeholder="Glittering Spa Annex" />
            <Field label="Public email" name="publicEmail" type="email" defaultValue={fieldText(identity, ['publicEmail', 'email', 'ownerEmail'])} placeholder="store@example.com" />
            <Field label="Phone" name="phone" defaultValue={fieldText(identity, ['publicPhone', 'phone', 'phoneNumber', 'contactPhone', 'storePhone'])} placeholder="0270000000" />
            <Field label="Hubtel approved sender ID" name="hubtelApprovedSenderId" defaultValue={fieldText(identity, ['hubtelApprovedSenderId'])} placeholder="GlitMedSpa" />
            <Field label="Address line" name="addressLine1" defaultValue={fieldText(identity, ['addressLine1', 'address'])} placeholder="Awoshie Junction" />
            <Field label="City" name="city" defaultValue={fieldText(identity, ['city', 'storeCity'])} placeholder="Awoshie" />
            <Field label="Country" name="country" defaultValue={fieldText(identity, ['country', 'storeCountry'], 'Ghana')} placeholder="Ghana" />
            <Field label="Website URL" name="websiteUrl" type="url" defaultValue={fieldText(identity, ['websiteUrl', 'websiteLink', 'storeWebsiteUrl'])} placeholder="https://www.example.com" />
          </div>
        </SectionCard>

        <SectionCard title="Social and marketplace visibility">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Instagram handle" name="instagramHandle" defaultValue={fieldText(identity, ['instagramHandle', 'instagramUrl'], nestedText(identity, ['publicProfile', 'instagramHandle']))} placeholder="glitteringmedspa" />
            <Field label="TikTok handle" name="tiktokHandle" defaultValue={fieldText(identity, ['tiktokHandle', 'tiktokUrl'], nestedText(identity, ['publicProfile', 'tiktokHandle']))} placeholder="glitteringmedspa" />
            <Field label="WhatsApp number" name="whatsappNumber" defaultValue={fieldText(identity, ['whatsappNumber'], nestedText(identity, ['publicProfile', 'whatsappNumber']))} placeholder="0270000000" />
            <SelectField label="Store status" name="status" defaultValue={fieldText(identity, ['status'], 'active')} options={['active', 'inactive', 'pending', 'suspended']} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <input type="checkbox" name="eligibleForBuy" defaultChecked={identity.eligibleForBuy === true} className="mt-1 h-4 w-4 accent-indigo-600" />
              <span><span className="block font-semibold text-slate-950">Eligible for Sedifex Market</span><span className="mt-1 block text-slate-500">Allow this store to appear as buy-ready when products/services are synced.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <input type="checkbox" name="buyOptOut" defaultChecked={identity.buyOptOut === true} className="mt-1 h-4 w-4 accent-indigo-600" />
              <span><span className="block font-semibold text-slate-950">Opt out from Buy</span><span className="mt-1 block text-slate-500">Use this if the store should not be promoted for online marketplace checkout.</span></span>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Payment details">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField label="Payment status" name="paymentStatus" defaultValue={fieldText(identity, ['paymentStatus'], 'active')} options={['active', 'inactive', 'pending', 'past_due', 'cancelled']} />
            <Field label="Payment provider" name="paymentProvider" defaultValue={fieldText(identity, ['paymentProvider'], nestedText(identity, ['billing', 'provider']))} placeholder="paystack" />
            <Field label="Plan key" name="planKey" defaultValue={nestedText(identity, ['billing', 'planKey'], fieldText(identity, ['planKey']))} placeholder="growth" />
            <SelectField label="Contract status" name="contractStatus" defaultValue={fieldText(identity, ['contractStatus'], nestedText(identity, ['billing', 'contractStatus'], 'active'))} options={['active', 'trialing', 'pending', 'past_due', 'ended', 'cancelled']} />
            <Field label="Contract start" name="contractStart" type="date" defaultValue={dateInputValue(identity.contractStart || asRecord(identity.billing).contractStart || asRecord(identity.billing).currentPeriodStart)} />
            <Field label="Contract end" name="contractEnd" type="date" defaultValue={dateInputValue(identity.contractEnd || asRecord(identity.billing).contractEnd || asRecord(identity.billing).currentPeriodEnd)} />
            <Field label="Last payment date" name="lastPaymentAt" type="date" defaultValue={dateInputValue(asRecord(identity.billing).lastPaymentAt || identity.lastPaymentAt)} />
            <Field label="Paystack customer code" name="paystackCustomerCode" defaultValue={nestedText(identity, ['billing', 'paystackCustomerCode'], fieldText(identity, ['paystackCustomerCode']))} placeholder="CUS_xxxxx" />
          </div>
        </SectionCard>

        <SectionCard title="Workspace">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Workspace ID" name="workspaceId" defaultValue={fieldText(identity, ['workspaceId'], nestedText(identity, ['workspace', 'id']))} placeholder="workspace_123" />
            <Field label="Workspace name" name="workspaceName" defaultValue={fieldText(identity, ['workspaceName'], nestedText(identity, ['workspace', 'name']))} placeholder="Glittering Spa HQ" />
            <SelectField label="Workspace status" name="workspaceStatus" defaultValue={fieldText(identity, ['workspaceStatus'], nestedText(identity, ['workspace', 'status'], 'active'))} options={['active', 'inactive', 'pending', 'suspended']} />
            <Field label="Workspace role" name="workspaceRole" defaultValue={fieldText(identity, ['workspaceRole'], nestedText(identity, ['workspace', 'role']))} placeholder="owner" />
          </div>
        </SectionCard>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/admin/stores/${encodeURIComponent(decodedStoreId)}`} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</Link>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500">
            <Save className="h-4 w-4" /> Save store changes
          </button>
        </div>
      </form>
    </div>
  );
}
