'use client';

import { Download, QrCode, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

export type PosterProduct = {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  storeName: string;
  category: string;
};

const DEFAULT_MESSAGE = 'Same-day delivery for orders placed before 4PM';

function qrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
}

function caption(product: PosterProduct, message: string) {
  return `${product.name} 🛒\n\nAvailable now on Sedifex Market\n✔ Verified seller\n✔ Secure checkout\n✔ ${message}\n\nComment LINK to receive the order link directly 📩\n\nPowered by Sedifex Market`;
}

function buildPosterSvg(product: PosterProduct, message: string) {
  const qr = qrUrl(product.productUrl);
  const safeName = product.name.replace(/&/g, '&amp;');
  const safePrice = (product.price || 'Shop now').replace(/&/g, '&amp;');
  const safeStore = product.storeName.replace(/&/g, '&amp;');
  const safeMessage = message.replace(/&/g, '&amp;');

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#ff7a00" />
        <stop offset="100%" stop-color="#ff9f43" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)" />
    <rect x="60" y="60" width="960" height="1230" rx="40" fill="#ffffff" />
    <text x="100" y="140" font-size="42" font-weight="700" fill="#ff7a00">Sedifex Market</text>
    <text x="100" y="200" font-size="74" font-weight="800" fill="#0f172a">${safeName}</text>
    <text x="100" y="255" font-size="36" fill="#334155">${safeStore}</text>
    <image href="${product.imageUrl}" x="120" y="310" width="840" height="520" preserveAspectRatio="xMidYMid meet" />
    <rect x="100" y="870" width="880" height="160" rx="28" fill="#fff7ed" />
    <text x="140" y="940" font-size="52" font-weight="800" fill="#ea580c">${safePrice}</text>
    <text x="140" y="995" font-size="32" fill="#475569">${safeMessage}</text>
    <image href="${qr}" x="740" y="1060" width="220" height="220" />
    <text x="100" y="1110" font-size="44" font-weight="700" fill="#0f172a">Scan to buy now</text>
    <text x="100" y="1170" font-size="28" fill="#475569">Secure checkout • Verified sellers • Ghana delivery</text>
    <rect x="100" y="1210" width="480" height="70" rx="35" fill="#0f172a" />
    <text x="140" y="1255" font-size="30" font-weight="700" fill="#ffffff">www.sedifexmarket.com</text>
  </svg>`;
}

export default function PosterGeneratorClient({ products }: { products: PosterProduct[] }) {
  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [deliveryMessage, setDeliveryMessage] = useState(DEFAULT_MESSAGE);

  const selected = useMemo(() => products.find((item) => item.id === selectedId) || products[0], [products, selectedId]);

  const generatedCaption = useMemo(() => selected ? caption(selected, deliveryMessage) : '', [selected, deliveryMessage]);

  function downloadPoster() {
    if (!selected) return;
    const svg = buildPosterSvg(selected, deliveryMessage);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sedifex-poster.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!selected) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">No products available yet.</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose product</label>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery message</label>
          <input value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><QrCode className="h-4 w-4 text-orange-500" /> Auto QR code</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">The QR code automatically links buyers directly to the Sedifex Market product page.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4 text-orange-500" /> Social caption</div>
          <textarea readOnly value={generatedCaption} rows={10} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700" />
        </div>

        <button onClick={downloadPoster} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400">
          <Download className="h-4 w-4" /> Download poster
        </button>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-slate-100 p-5">
        <div className="mx-auto max-w-[420px] overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <div className="bg-orange-500 px-6 py-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p>
            <h3 className="mt-3 text-3xl font-black leading-tight">{selected.name}</h3>
            <p className="mt-2 text-sm text-orange-100">{selected.storeName}</p>
          </div>

          <div className="bg-white p-5">
            <div className="overflow-hidden rounded-3xl bg-slate-100">
              {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-[360px] w-full object-cover" /> : <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">No product image</div>}
            </div>

            <div className="mt-5 rounded-3xl bg-orange-50 p-5">
              <p className="text-3xl font-black text-orange-600">{selected.price || 'Shop now'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{deliveryMessage}</p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-slate-950">Scan to buy now</p>
                <p className="mt-2 text-sm text-slate-500">Verified sellers • Secure checkout</p>
              </div>
              <img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
