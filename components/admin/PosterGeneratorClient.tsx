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

type TemplateKey = 'market' | 'beauty' | 'flash' | 'minimal' | 'dark';

type PosterTemplate = {
  key: TemplateKey;
  name: string;
  description: string;
  accent: string;
  accentSoft: string;
  dark: string;
  light: string;
  theme: 'light' | 'dark';
};

const DEFAULT_MESSAGE = 'Same-day delivery for orders placed before 4PM';

const TEMPLATES: PosterTemplate[] = [
  { key: 'market', name: 'Sedifex Market', description: 'Clean orange marketplace style', accent: '#ff7a00', accentSoft: '#fff7ed', dark: '#0f172a', light: '#ffffff', theme: 'light' },
  { key: 'beauty', name: 'Beauty Glow', description: 'Soft pink style for skincare, makeup, spa', accent: '#db2777', accentSoft: '#fdf2f8', dark: '#4a044e', light: '#ffffff', theme: 'light' },
  { key: 'flash', name: 'Flash Sale', description: 'Bold yellow promo style for deals', accent: '#facc15', accentSoft: '#fef9c3', dark: '#18181b', light: '#ffffff', theme: 'dark' },
  { key: 'minimal', name: 'Clean White', description: 'Simple premium product showcase', accent: '#2563eb', accentSoft: '#eff6ff', dark: '#0f172a', light: '#ffffff', theme: 'light' },
  { key: 'dark', name: 'Premium Dark', description: 'High contrast luxury poster', accent: '#f97316', accentSoft: '#1f2937', dark: '#020617', light: '#ffffff', theme: 'dark' },
];

function qrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function caption(product: PosterProduct, message: string, template: PosterTemplate) {
  const opener = template.key === 'flash' ? 'Limited deal on Sedifex Market ⚡' : template.key === 'beauty' ? 'Glow up with verified beauty products ✨' : 'Available now on Sedifex Market 🛒';
  return `${product.name}\n\n${opener}\n✔ Verified seller\n✔ Secure checkout\n✔ ${message}\n\nComment LINK to receive the order link directly 📩\n\nPowered by Sedifex Market`;
}

function buildPosterSvg(product: PosterProduct, message: string, template: PosterTemplate) {
  const qr = qrUrl(product.productUrl);
  const safeName = escapeSvg(product.name);
  const safePrice = escapeSvg(product.price || 'Shop now');
  const safeStore = escapeSvg(product.storeName);
  const safeMessage = escapeSvg(message);
  const safeTemplateName = escapeSvg(template.name);
  const background = template.theme === 'dark' ? template.dark : template.accent;
  const card = template.theme === 'dark' ? '#0f172a' : template.light;
  const primaryText = template.theme === 'dark' ? '#ffffff' : '#0f172a';
  const secondaryText = template.theme === 'dark' ? '#cbd5e1' : '#475569';
  const badgeFill = template.theme === 'dark' ? '#111827' : template.accentSoft;
  const footerFill = template.theme === 'dark' ? template.accent : template.dark;
  const promoText = template.key === 'flash' ? 'LIMITED OFFER' : template.key === 'beauty' ? 'BEAUTY PICK' : template.key === 'minimal' ? 'FEATURED PRODUCT' : template.key === 'dark' ? 'PREMIUM PICK' : 'VERIFIED MARKET ITEM';

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${background}" />
        <stop offset="100%" stop-color="${template.accent}" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)" />
    <rect x="60" y="60" width="960" height="1230" rx="40" fill="${card}" />
    <rect x="100" y="105" width="320" height="54" rx="27" fill="${badgeFill}" />
    <text x="130" y="141" font-size="22" font-weight="800" fill="${template.accent}">${promoText}</text>
    <text x="100" y="220" font-size="42" font-weight="700" fill="${template.accent}">Sedifex Market</text>
    <text x="100" y="290" font-size="68" font-weight="900" fill="${primaryText}">${safeName}</text>
    <text x="100" y="345" font-size="34" fill="${secondaryText}">${safeStore}</text>
    <rect x="100" y="390" width="880" height="470" rx="34" fill="${template.theme === 'dark' ? '#111827' : '#f8fafc'}" />
    <image href="${product.imageUrl}" x="135" y="420" width="810" height="410" preserveAspectRatio="xMidYMid meet" />
    <rect x="100" y="900" width="880" height="150" rx="30" fill="${badgeFill}" />
    <text x="140" y="965" font-size="54" font-weight="900" fill="${template.accent}">${safePrice}</text>
    <text x="140" y="1018" font-size="31" fill="${secondaryText}">${safeMessage}</text>
    <rect x="100" y="1085" width="560" height="165" rx="30" fill="${template.theme === 'dark' ? '#111827' : '#f8fafc'}" />
    <text x="140" y="1148" font-size="43" font-weight="800" fill="${primaryText}">Scan to buy now</text>
    <text x="140" y="1200" font-size="28" fill="${secondaryText}">Secure checkout • Verified sellers</text>
    <text x="140" y="1235" font-size="22" fill="${secondaryText}">${safeTemplateName} template</text>
    <image href="${qr}" x="740" y="1060" width="220" height="220" />
    <rect x="100" y="1265" width="480" height="60" rx="30" fill="${footerFill}" />
    <text x="140" y="1304" font-size="27" font-weight="800" fill="#ffffff">www.sedifexmarket.com</text>
  </svg>`;
}

export default function PosterGeneratorClient({ products }: { products: PosterProduct[] }) {
  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [deliveryMessage, setDeliveryMessage] = useState(DEFAULT_MESSAGE);
  const [templateKey, setTemplateKey] = useState<TemplateKey>('market');

  const selected = useMemo(() => products.find((item) => item.id === selectedId) || products[0], [products, selectedId]);
  const selectedTemplate = useMemo(() => TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0], [templateKey]);
  const generatedCaption = useMemo(() => selected ? caption(selected, deliveryMessage, selectedTemplate) : '', [selected, deliveryMessage, selectedTemplate]);

  function downloadPoster() {
    if (!selected) return;
    const svg = buildPosterSvg(selected, deliveryMessage, selectedTemplate);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${selectedTemplate.key}-sedifex-poster.svg`;
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose template</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => setTemplateKey(template.key)}
                className={`rounded-2xl border p-4 text-left transition ${templateKey === template.key ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200'}`}
              >
                <span className="mb-3 block h-3 w-16 rounded-full" style={{ background: template.accent }} />
                <span className="block text-sm font-bold text-slate-950">{template.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{template.description}</span>
              </button>
            ))}
          </div>
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
          <Download className="h-4 w-4" /> Download {selectedTemplate.name} poster
        </button>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-slate-100 p-5">
        <div className={`mx-auto max-w-[420px] overflow-hidden rounded-[32px] shadow-2xl ${selectedTemplate.theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-950'}`}>
          <div className="px-6 py-5 text-white" style={{ background: selectedTemplate.accent }}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p>
            <h3 className="mt-3 text-3xl font-black leading-tight">{selected.name}</h3>
            <p className="mt-2 text-sm text-white/80">{selected.storeName}</p>
          </div>

          <div className="p-5">
            <div className={`overflow-hidden rounded-3xl ${selectedTemplate.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-[360px] w-full object-cover" /> : <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">No product image</div>}
            </div>

            <div className="mt-5 rounded-3xl p-5" style={{ background: selectedTemplate.theme === 'dark' ? '#111827' : selectedTemplate.accentSoft }}>
              <p className="text-3xl font-black" style={{ color: selectedTemplate.accent }}>{selected.price || 'Shop now'}</p>
              <p className={`mt-2 text-sm leading-6 ${selectedTemplate.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{deliveryMessage}</p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold">Scan to buy now</p>
                <p className={`mt-2 text-sm ${selectedTemplate.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Verified sellers • Secure checkout</p>
                <p className={`mt-1 text-xs ${selectedTemplate.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{selectedTemplate.name}</p>
              </div>
              <img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
