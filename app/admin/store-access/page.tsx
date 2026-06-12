import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, Search, ShieldCheck, Store, UserRoundCog } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { adminAuth, adminFirestore, getFirebaseEnvStatus } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Promise<{ q?: string; status?: string; message?: string }>;
type StoreRecord = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null; createTime?: string | null };
type MergedStore = {
  id: string;
  profile: StoreRecord | null;
  settings: StoreRecord | null;
  merged: StoreRecord;
};

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function fieldText(store: StoreRecord | null | undefined, fields: string[], fallback = '') {
  if (!store) return fallback;
  for (const field of fields) {
    const value = text(store[field], '');
    if (value) return value;
  }
  return fallback;
}

function storeName(store: MergedStore) {
  return fieldText(store.merged, ['displayName', 'storeName', 'name', 'businessName', 'merchantName', 'ownerName'], store.id);
}

function storeEmail(store: MergedStore) {
  return fieldText(store.merged, ['loginEmail', 'authEmail', 'publicEmail', 'email', 'ownerEmail', 'adminEmail', 'supportEmail', 'contactEmail'], 'No email set');
}

function storeUid(store: MergedStore) {
  return fieldText(store.merged, ['authUid', 'uid', 'ownerUid', 'userId', 'createdByUid'], store.id);
}

function searchableText(store: MergedStore) {
  return [store.id, storeName(store), storeEmail(store), storeUid(store)].join(' ').toLowerCase();
}

function mergeStores(profiles: StoreRecord[], settings: StoreRecord[]) {
  const byId = new Map<string, MergedStore>();

  for (const profile of profiles) {
    const id = String(profile.id || profile.storeId || '').trim();
    if (!id) continue;
    byId.set(id, { id, profile, settings: null, merged: { ...profile, id } });
  }

  for (const setting of settings) {
    const id = String(setting.id || setting.storeId || '').trim();
    if (!id) continue;
    const current = byId.get(id);
    byId.set(id, {
      id,
      profile: current?.profile ?? null,
      settings: setting,
      merged: { ...(setting || {}), ...(current?.profile || {}), id },
    });
  }

  return [...byId.values()].sort((a, b) => storeName(a).localeCompare(storeName(b)));
}

async function loadStores() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return { ok: false, error: 'Firebase environment variables are not ready in Vercel.', stores: [] as MergedStore[] };
  }

  try {
    const db = adminFirestore();
    const [profilesSnap, settingsSnap] = await Promise.all([
      db.collection('stores').limit(500).get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      db.collection('storeSettings').limit(500).get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    ]);

    const profiles = profilesSnap.docs.map((doc) => ({ ...(doc.data() as StoreRecord), id: doc.id, path: doc.ref.path }));
    const settings = settingsSnap.docs.map((doc) => ({ ...(doc.data() as StoreRecord), id: doc.id, path: doc.ref.path }));

    return { ok: true, error: null, stores: mergeStores(profiles, settings) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load store access data.',
      stores: [] as MergedStore[],
    };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to update the store login.';
}

function resultRedirect(status: 'success' | 'error', message: string) {
  redirect(`/admin/store-access?status=${status}&message=${encodeURIComponent(message)}`);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resetStoreAccess(formData: FormData) {
  'use server';

  const storeId = text(formData.get('storeId'));
  const uid = text(formData.get('uid'));
  const email = text(formData.get('email')).toLowerCase();
  const password = text(formData.get('password'));
  let successMessage = '';

  try {
    if (!storeId) throw new Error('Select a store before resetting access.');
    if (!uid) throw new Error('Enter the Firebase Auth UID for this store.');
    if (!email && !password) throw new Error('Enter a new email or a new password.');
    if (email && !isEmail(email)) throw new Error('Enter a valid email address.');
    if (password && password.length < 6) throw new Error('Password must be at least 6 characters.');

    const now = new Date().toISOString();
    const authPayload: { email?: string; password?: string; emailVerified?: boolean; disabled?: boolean } = { disabled: false };
    if (email) {
      authPayload.email = email;
      authPayload.emailVerified = false;
    }
    if (password) authPayload.password = password;

    const user = await adminAuth().updateUser(uid, authPayload);
    const finalEmail = user.email || email;
    const db = adminFirestore();

    const authSyncPayload = {
      authUid: user.uid,
      uid: user.uid,
      ownerUid: user.uid,
      loginEmail: finalEmail,
      authEmail: finalEmail,
      email: finalEmail,
      ownerEmail: finalEmail,
      accessUpdatedAt: now,
      adminUpdatedAt: now,
      adminUpdatedFrom: 'sedifexadmin-store-access',
    };

    await Promise.all([
      db.collection('stores').doc(storeId).set(authSyncPayload, { merge: true }),
      db.collection('storeSettings').doc(storeId).set(authSyncPayload, { merge: true }),
      db.collection('adminAuditLogs').add({
        action: 'store_auth_reset',
        storeId,
        uid: user.uid,
        email: finalEmail,
        emailChanged: Boolean(email),
        passwordChanged: Boolean(password),
        actor: 'sedifexadmin',
        createdAt: now,
      }),
    ]);


    successMessage = `Access updated for ${finalEmail || user.uid}.`;
  } catch (error) {
    resultRedirect('error', errorMessage(error));
  }

  resultRedirect('success', successMessage);
}

function Alert({ status, message }: { status?: string; message?: string }) {
  if (!status || !message) return null;
  const isSuccess = status === 'success';
  return (
    <div className={`rounded-2xl border p-4 text-sm ${isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      <div className="flex gap-3">
        {isSuccess ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}

export default async function StoreAccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q || '').trim().toLowerCase();
  const result = await loadStores();
  const allStores = result.stores;
  const stores = query ? allStores.filter((store) => searchableText(store).includes(query)) : allStores;
  const storesWithUid = allStores.filter((store) => storeUid(store) !== store.id).length;
  const storesWithEmail = allStores.filter((store) => storeEmail(store) !== 'No email set').length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
          <ShieldCheck className="h-4 w-4" /> Firebase Auth Store Access
        </div>
        <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">Reset a store login email or password safely.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          This page updates Firebase Authentication by UID, then writes the same UID and login email back to both /stores and /storeSettings so Sedifex can recognize the store correctly.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loaded stores" value={result.ok ? String(allStores.length) : 'Setup'} delta={result.ok ? 'From /stores + /storeSettings' : 'Firebase not ready'} />
        <StatCard label="With email" value={String(storesWithEmail)} delta="Login email detected" />
        <StatCard label="With UID field" value={String(storesWithUid)} delta="Auth UID recognized" />
        <StatCard label="Security" value="No password saved" delta="Only Auth receives password" />
      </section>

      <Alert status={params.status} message={params.message} />

      {result.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Store access data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <SectionCard title="Find store and reset login">
        <form className="mb-4 flex flex-col gap-3 sm:flex-row" action="/admin/store-access">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={params.q || ''}
              placeholder="Search by store name, email, UID, or store ID"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Search</button>
        </form>

        <div className="space-y-4">
          {stores.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No store matches this search.</div>
          ) : stores.map((store) => {
            const name = storeName(store);
            const email = storeEmail(store) === 'No email set' ? '' : storeEmail(store);
            const uid = storeUid(store);
            return (
              <div key={store.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Store className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-950">{name}</h3>
                        <p className="break-all text-xs text-slate-500">Store ID: {store.id}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p className="break-all"><UserRoundCog className="mr-1 inline h-4 w-4 text-slate-400" /><strong>UID:</strong> {uid || 'Not set'}</p>
                      <p className="break-all"><KeyRound className="mr-1 inline h-4 w-4 text-slate-400" /><strong>Email:</strong> {email || 'Not set'}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge tone={email ? 'green' : 'yellow'}>{email ? 'Email ready' : 'Email missing'}</StatusBadge>
                      <StatusBadge tone={uid ? 'green' : 'red'}>{uid ? 'UID ready' : 'UID missing'}</StatusBadge>
                      <Link href={`/admin/stores/${encodeURIComponent(store.id)}`} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50">Open store</Link>
                    </div>
                  </div>

                  <form action={resetStoreAccess} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                    <input type="hidden" name="storeId" value={store.id} />
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Firebase Auth UID</span>
                      <input
                        name="uid"
                        required
                        defaultValue={uid}
                        placeholder="Firebase Authentication UID"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">New login email</span>
                      <input
                        type="email"
                        name="email"
                        defaultValue={email}
                        placeholder="store@example.com"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">New password</span>
                      <input
                        type="password"
                        name="password"
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Leave blank if only changing email"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-500">
                        <LockKeyhole className="h-4 w-4" /> Update Auth + Firestore
                      </button>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Password is sent to Firebase Auth only. Sedifex saves UID and email metadata, not the password.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
