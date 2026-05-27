'use client';

import { Download, QrCode, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PosterProduct } from './PosterGeneratorClient';

type TemplateKey = 'bigDeals' | 'market' | 'collage';
type PlatformKey = 'instagram' | 'tiktok' | 'whatsapp' | 'telegram' | 'facebook' | 'generic';
type ExportFormat = 'png' | 'jpeg' | 'svg';

type Template = { key: TemplateKey; name: string; description: string; accent: string };

const WIDTH = 1080;
const HEIGHT = 1350;
const DEFAULT_MESSAGE = 'Same-day delivery for orders placed before 4PM';

const TEMPLATES: Template[] = [
  { key: 'bigDeals', name: 'Shop Local Big Deals', description: 'Campaign flyer with orange/green Sedifex Market branding', accent: '#ff6a00' },
  { key: 'market', name: 'Classic Product Poster', description: 'Clean single-product marketplace poster', accent: '#ff7a00' },
  { key: 'collage', name: 'Product Collage', description: 'Show 2–4 searched products in one flyer', accent: '#ff7a00' },
];

const PLATFORMS: { key: PlatformKey; name: string; hint: string }[] = [
  { key: 'instagram', name: 'Instagram', hint: 'Comment LINK or tap link in bio' },
  { key: 'tiktok', name: 'TikTok', hint: 'Comment LINK for direct order' },
  { key: 'whatsapp', name: 'WhatsApp', hint: 'Direct product link included' },
  { key: 'telegram', name: 'Telegram', hint: 'Clickable link included' },
  { key: 'facebook', name: 'Facebook', hint: 'Clickable link included' },
  { key: 'generic', name: 'Generic', hint: 'Works anywhere' },
];

function qrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortText(value: string, max = 42) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sedifex-poster';
}

function marketUrl(products: PosterProduct[]) {
  const store = products[0]?.storeName || '';
  return store ? `https://www.sedifexmarket.com/products?search=${encodeURIComponent(store)}` : 'https://www.sedifexmarket.com/products';
}

function cta(platform: PlatformKey, url: string) {
  if (platform === 'instagram') return 'Comment LINK or tap the link in bio to order 👆';
  if (platform === 'tiktok') return 'Comment “LINK” and we’ll send the order link directly 📩';
  if (platform === 'whatsapp') return `Order here: ${url}`;
  if (platform === 'telegram') return `Tap to order on Sedifex Market: ${url}`;
  if (platform === 'facebook') return `Shop now on Sedifex Market: ${url}`;
  return `Scan the QR code or shop here: ${url}`;
}

function caption(product: PosterProduct, products: PosterProduct[], template: TemplateKey, platform: PlatformKey, message: string) {
  const url = template === 'collage' ? marketUrl(products) : product.productUrl;
  if (template === 'collage') {
    const lines = products.map((item, index) => `${index + 1}. ${item.name}${item.price ? ` — ${item.price}` : ''}`).join('\n');
    return `Fresh picks on Sedifex Market 🛒\n\n${lines}\n\n✔ Verified sellers\n✔ Secure checkout\n✔ ${message}\n\n${cta(platform, url)}\n\nPowered by Sedifex Market\n#SedifexMarket #ShopOnlineGhana #BuyOnline`;
  }
  return `${product.name}\n\nAvailable now on Sedifex Market 🛒\n✔ Verified seller\n✔ Secure checkout\n✔ ${message}\n\n${cta(platform, url)}\n\nPowered by Sedifex Market\n#SedifexMarket #ShopOnlineGhana #BuyOnline`;
}

function buildBigDealsSvg(product: PosterProduct, message: string) {
  const qr = qrUrl(product.productUrl);
  const productName = escapeSvg(shortText(product.name, 34));
  const productPrice = escapeSvg(shortText(product.price || 'Shop now', 24));
  const deliveryMessage = escapeSvg(shortText(message, 38));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs><linearGradient id="o" x1="0" x2="1"><stop stop-color="#ff5400"/><stop offset="1" stop-color="#ff8a00"/></linearGradient><linearGradient id="g" x1="0" x2="1"><stop stop-color="#009a44"/><stop offset="1" stop-color="#006b3f"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#052e16" flood-opacity=".35"/></filter></defs>
    <rect width="1080" height="1350" fill="#064e3b"/><path d="M0 0H620L520 1350H0Z" fill="url(#o)"/><path d="M520 0H1080V1350H430Z" fill="url(#g)"/>
    <text x="78" y="112" font-size="44" font-weight="900" fill="#fff">Sedifex</text><text x="80" y="150" font-size="28" font-weight="700" fill="#fff7ed">Market</text>
    <text x="78" y="300" font-size="62" font-weight="950" fill="#fff">Shop Local,</text><text x="78" y="370" font-size="62" font-weight="950" fill="#fff">Big Deals</text>
    <text x="78" y="430" font-size="31" font-weight="800" fill="#fff7ed">Trusted Ghana stores,</text><text x="78" y="470" font-size="31" font-weight="800" fill="#fff7ed">delivered to you.</text>
    <g font-size="25" font-weight="900" fill="#064e3b"><rect x="78" y="530" width="360" height="54" rx="27" fill="#ffd43b"/><text x="118" y="566">Trusted Ghana Stores</text><rect x="78" y="602" width="360" height="54" rx="27" fill="#ffd43b"/><text x="118" y="638">Secure Checkout</text><rect x="78" y="674" width="390" height="64" rx="32" fill="#ffd43b"/><text x="118" y="700">Same-day Delivery</text><text x="118" y="728" font-size="20">for orders before 4PM</text><rect x="78" y="756" width="360" height="54" rx="27" fill="#ffd43b"/><text x="118" y="792">Verified Sellers</text></g>
    <rect x="78" y="875" width="285" height="78" rx="39" fill="#fff"/><text x="112" y="925" font-size="38" font-weight="950" fill="#0f172a">SHOP NOW</text><circle cx="327" cy="914" r="24" fill="#064e3b"/><text x="316" y="927" font-size="32" font-weight="950" fill="#fff">›</text>
    <text x="78" y="990" font-size="26" font-weight="800" fill="#fff7ed">#ShopWithSedifex</text>
    <rect x="78" y="1018" width="250" height="128" rx="24" fill="#fff"/><image href="${qr}" x="96" y="1033" width="98" height="98"/><text x="246" y="1072" text-anchor="middle" font-size="19" font-weight="950" fill="#064e3b">SCAN</text><text x="246" y="1100" text-anchor="middle" font-size="19" font-weight="950" fill="#064e3b">TO BUY</text>
    <ellipse cx="725" cy="1060" rx="250" ry="42" fill="#fff" opacity=".94"/><rect x="545" y="245" width="370" height="570" rx="36" fill="#fff" opacity=".96" filter="url(#s)"/><image href="${product.imageUrl}" x="565" y="270" width="330" height="520" preserveAspectRatio="xMidYMid meet"/>
    <text x="725" y="865" text-anchor="middle" font-size="34" font-weight="900" fill="#fff">${productName}</text><text x="725" y="940" text-anchor="middle" font-size="58" font-weight="950" fill="#fff">${productPrice}</text><text x="725" y="992" text-anchor="middle" font-size="28" font-weight="800" fill="#fff7ed">${deliveryMessage}</text>
    <rect x="0" y="1165" width="1080" height="92" fill="#064e3b"/><text x="110" y="1220" font-size="26" font-weight="900" fill="#fff">Safe. Simple.</text><text x="340" y="1220" font-size="26" font-weight="900" fill="#fff">Shop local. Support Ghana.</text><text x="760" y="1220" font-size="26" font-weight="900" fill="#fff">Fast delivery.</text>
    <rect x="0" y="1257" width="1080" height="93" fill="#f15a00"/><text x="78" y="1315" font-size="26" font-weight="900" fill="#fff">www.sedifexmarket.com</text><text x="745" y="1315" font-size="26" font-weight="900" fill="#fff">Powered by Sedifex</text></svg>`;
}

function buildMarketSvg(product: PosterProduct, message: string) {
  const qr = qrUrl(product.productUrl);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="1080" height="1350" fill="#ff7a00"/><rect x="60" y="60" width="960" height="1230" rx="42" fill="#fff"/><text x="105" y="150" font-size="42" font-weight="900" fill="#ff7a00">Sedifex Market</text><text x="105" y="235" font-size="68" font-weight="950" fill="#0f172a">${escapeSvg(product.name)}</text><text x="105" y="285" font-size="32" font-weight="800" fill="#475569">${escapeSvg(product.storeName)}</text><rect x="105" y="335" width="870" height="515" rx="36" fill="#f8fafc"/><image href="${product.imageUrl}" x="135" y="365" width="810" height="455" preserveAspectRatio="xMidYMid meet"/><rect x="105" y="890" width="870" height="145" rx="30" fill="#fff7ed"/><text x="145" y="955" font-size="56" font-weight="950" fill="#ea580c">${escapeSvg(product.price || 'Shop now')}</text><text x="145" y="1005" font-size="30" font-weight="800" fill="#475569">${escapeSvg(message)}</text><text x="105" y="1140" font-size="44" font-weight="950" fill="#0f172a">Scan to buy now</text><text x="105" y="1190" font-size="28" font-weight="800" fill="#475569">Verified sellers • Secure checkout</text><image href="${qr}" x="755" y="1080" width="210" height="210"/><rect x="105" y="1260" width="500" height="62" rx="31" fill="#0f172a"/><text x="145" y="1300" font-size="28" font-weight="900" fill="#fff">www.sedifexmarket.com</text></svg>`;
}

function buildCollageSvg(products: PosterProduct[], message: string) {
  const chosen = products.slice(0, 4);
  const qr = qrUrl(marketUrl(chosen));
  const cards = chosen.map((product, index) => {
    const positions = [{ x: 90, y: 345 }, { x: 555, y: 345 }, { x: 90, y: 755 }, { x: 555, y: 755 }];
    const p = positions[index];
    return `<rect x="${p.x}" y="${p.y}" width="435" height="360" rx="28" fill="#fff"/><rect x="${p.x + 18}" y="${p.y + 18}" width="399" height="215" rx="22" fill="#f8fafc"/><image href="${product.imageUrl}" x="${p.x + 28}" y="${p.y + 28}" width="379" height="195" preserveAspectRatio="xMidYMid meet"/><text x="${p.x + 24}" y="${p.y + 272}" font-size="26" font-weight="900" fill="#0f172a">${escapeSvg(product.name.slice(0, 34))}</text><text x="${p.x + 24}" y="${p.y + 320}" font-size="30" font-weight="900" fill="#ff7a00">${escapeSvg(product.price || 'Shop now')}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="1080" height="1350" fill="#ff7a00"/><text x="90" y="125" font-size="42" font-weight="900" fill="#fff">Sedifex Market</text><text x="90" y="205" font-size="78" font-weight="950" fill="#fff">Fresh Picks</text><text x="90" y="260" font-size="34" font-weight="800" fill="#fff7ed">Shop verified products online</text>${cards}<rect x="90" y="1160" width="610" height="110" rx="30" fill="#0f172a"/><text x="130" y="1210" font-size="34" font-weight="900" fill="#fff">${escapeSvg(message)}</text><text x="130" y="1250" font-size="24" fill="#cbd5e1">Scan QR to shop these products</text><image href="${qr}" x="770" y="1125" width="220" height="220"/></svg>`;
}

function buildSvg(product: PosterProduct, products: PosterProduct[], template: TemplateKey, message: string) {
  if (template === 'bigDeals') return buildBigDealsSvg(product, message);
  if (template === 'collage') return buildCollageSvg(products, message);
  return buildMarketSvg(product, message);
}

async function inlineSvgImages(svg: string) {
  const hrefs = Array.from(svg.matchAll(/href="(https?:\/\/[^\"]+)"/g)).map((match) => match[1]);
  let hydrated = svg;
  await Promise.all(hrefs.map(async (href) => {
    try {
      const response = await fetch(`/api/admin/poster-assets?url=${encodeURIComponent(href)}`);
      if (!response.ok) return;
      const data = await response.json() as { dataUrl?: string };
      if (data.dataUrl) hydrated = hydrated.split(href).join(data.dataUrl);
    } catch {}
  }));
  return hydrated;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function rasterize(svg: string, filename: string, format: Exclude<ExportFormat, 'svg'>) {
  const svgBlob = new Blob([await inlineSvgImages(svg)], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Export failed.')), format === 'png' ? 'image/png' : 'image/jpeg', format === 'jpeg' ? 0.92 : undefined));
    saveBlob(blob, `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function PosterGeneratorClientV2({ products }: { products: PosterProduct[] }) {
  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [selectedCollageIds, setSelectedCollageIds] = useState<string[]>(products.slice(0, 4).map((item) => item.id));
  const [templateKey, setTemplateKey] = useState<TemplateKey>('bigDeals');
  const [platformKey, setPlatformKey] = useState<PlatformKey>('instagram');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const selected = useMemo(() => products.find((item) => item.id === selectedId) || products[0], [products, selectedId]);
  const searchedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return selected ? [selected] : [];
    return products.filter((item) => [item.name, item.storeName, item.category, item.price].some((value) => value.toLowerCase().includes(q))).slice(0, 40);
  }, [products, search, selected]);
  const productOptions = useMemo(() => selected && !searchedProducts.some((item) => item.id === selected.id) ? [selected, ...searchedProducts] : searchedProducts, [searchedProducts, selected]);
  const template = TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0];
  const platform = PLATFORMS.find((item) => item.key === platformKey) || PLATFORMS[0];
  const collageProducts = useMemo(() => selectedCollageIds.map((id) => products.find((item) => item.id === id)).filter(Boolean).slice(0, 4) as PosterProduct[], [products, selectedCollageIds]);
  const activeProducts = templateKey === 'collage' ? collageProducts : [selected].filter(Boolean) as PosterProduct[];
  const generatedCaption = selected ? caption(selected, activeProducts, templateKey, platformKey, message) : '';

  function toggleCollageProduct(id: string) {
    setSelectedCollageIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 4 ? [...current.slice(1), id] : [...current, id]);
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(generatedCaption);
    setNotice(`Copied ${platform.name} caption`);
  }

  async function download(format: ExportFormat) {
    if (!selected || exporting) return;
    const svg = buildSvg(selected, activeProducts.length ? activeProducts : [selected], templateKey, message);
    const name = `${templateKey === 'collage' ? 'sedifex-product-collage' : slug(selected.name)}-${templateKey}-poster`;
    setExporting(format);
    setNotice('');
    try {
      if (format === 'svg') saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`);
      else await rasterize(svg, name, format);
      setNotice(`Downloaded ${format.toUpperCase()} poster`);
    } catch {
      setNotice('Export failed because one image could not be loaded. Try SVG backup or check the product image URL.');
    } finally {
      setExporting(null);
    }
  }

  if (!selected) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">No verified, poster-ready products available yet.</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search product</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setSearch(searchDraft.trim()); }} placeholder="Search product, store, category, or price" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
            <button type="button" onClick={() => setSearch(searchDraft.trim())} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400"><Search className="h-4 w-4" /> Search</button>
            {search ? <button type="button" onClick={() => { setSearch(''); setSearchDraft(''); }} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear</button> : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">Showing {productOptions.length} result{productOptions.length === 1 ? '' : 's'}{search ? ` for “${search}”` : '. Search to find more products.'}</p>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
            {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.storeName}</option>)}
          </select>
        </div>

        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose template</label><div className="grid gap-3 sm:grid-cols-2">{TEMPLATES.map((item) => <button key={item.key} type="button" onClick={() => setTemplateKey(item.key)} className={`rounded-2xl border p-4 text-left transition ${templateKey === item.key ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200'}`}><span className="mb-3 block h-3 w-16 rounded-full" style={{ background: item.accent }} /><span className="block text-sm font-bold text-slate-950">{item.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></button>)}</div></div>
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Platform caption style</label><select value={platformKey} onChange={(event) => setPlatformKey(event.target.value as PlatformKey)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">{PLATFORMS.map((item) => <option key={item.key} value={item.key}>{item.name} — {item.hint}</option>)}</select><p className="mt-2 text-xs text-slate-500">{platform.hint}</p></div>
        {templateKey === 'collage' ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Pick 2–4 searched products for collage</label><div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{productOptions.map((product) => { const checked = selectedCollageIds.includes(product.id); return <button key={product.id} type="button" onClick={() => toggleCollageProduct(product.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${checked ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'}`}><span className={`h-4 w-4 rounded border ${checked ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'}`} /><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{product.name}</span><span className="block truncate text-xs text-slate-500">{product.price || 'No price'}</span></span></button>; })}</div><p className="mt-3 text-xs text-slate-500">Selected: {selectedCollageIds.length}/4. Search first to add more products.</p></div> : null}
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery message</label><input value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" /></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><QrCode className="h-4 w-4 text-orange-500" /> Auto QR code</div><p className="mt-2 text-sm leading-6 text-slate-600">The QR code links to the selected product or to a marketplace search for collage flyers.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4 text-orange-500" /> {platform.name} caption</div><textarea readOnly value={generatedCaption} rows={10} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700" /><button type="button" onClick={copyCaption} className="mt-3 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800">Copy caption</button></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Download poster</p><div className="mt-3 flex flex-wrap gap-3"><button disabled={Boolean(exporting)} onClick={() => download('png')} className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Download className="h-4 w-4" /> {exporting === 'png' ? 'Creating PNG…' : 'Download PNG'}</button><button disabled={Boolean(exporting)} onClick={() => download('jpeg')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Download className="h-4 w-4" /> {exporting === 'jpeg' ? 'Creating JPEG…' : 'Download JPEG'}</button><button disabled={Boolean(exporting)} onClick={() => download('svg')} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-60">SVG backup</button></div>{notice ? <p className="mt-3 text-xs font-semibold text-slate-600">{notice}</p> : null}</div>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-slate-100 p-5">
        {templateKey === 'bigDeals' ? <div className="mx-auto max-w-[420px] overflow-hidden rounded-[28px] bg-orange-500 text-white shadow-2xl"><div className="grid min-h-[560px] grid-cols-[0.48fr_0.52fr]"><div className="p-5"><p className="text-xl font-black">Sedifex</p><p className="text-xs font-bold">Market</p><h3 className="mt-12 text-3xl font-black leading-tight">Shop Local,<br />Big Deals</h3><p className="mt-3 text-sm font-bold text-orange-100">Trusted Ghana stores, delivered to you.</p><div className="mt-6 space-y-2 text-[10px] font-black text-green-900"><p className="rounded-full bg-yellow-300 px-3 py-2">Trusted Ghana Stores</p><p className="rounded-full bg-yellow-300 px-3 py-2">Secure Checkout</p><p className="rounded-full bg-yellow-300 px-3 py-2">Same-day Delivery</p><p className="rounded-full bg-yellow-300 px-3 py-2">Verified Sellers</p></div><div className="mt-5 flex items-center gap-2 rounded-2xl bg-white p-2 text-green-900"><img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-16 w-16" /><span className="text-[10px] font-black">SCAN<br />TO BUY</span></div></div><div className="bg-green-700 p-5"><div className="mt-20 rounded-3xl bg-white p-4 shadow-2xl">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-64 w-full object-contain" /> : null}</div><p className="mt-5 text-center text-2xl font-black">{selected.price || 'Shop now'}</p><p className="mt-2 text-center text-xs font-bold text-green-100">{message}</p></div></div><div className="bg-green-900 px-5 py-3 text-xs font-bold">Safe. Simple. • Shop local. Support Ghana. • Fast delivery.</div><div className="bg-orange-600 px-5 py-3 text-xs font-bold">www.sedifexmarket.com <span className="float-right">Powered by Sedifex</span></div></div> : templateKey === 'collage' ? <div className="mx-auto max-w-[420px] overflow-hidden rounded-[32px] bg-orange-500 p-6 text-white shadow-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p><h3 className="mt-3 text-4xl font-black leading-tight">Fresh Picks</h3><div className="mt-6 grid grid-cols-2 gap-3">{activeProducts.slice(0, 4).map((product) => <div key={product.id} className="rounded-3xl bg-white p-3 text-slate-950">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-36 w-full rounded-2xl bg-slate-100 object-cover" /> : null}<p className="mt-3 truncate text-sm font-black">{product.name}</p><p className="mt-1 text-sm font-black text-orange-500">{product.price || 'Shop now'}</p></div>)}</div><div className="mt-6 flex items-center justify-between gap-4 rounded-3xl bg-slate-950 p-4"><div><p className="text-lg font-black">Scan to shop</p><p className="mt-1 text-xs text-slate-300">{message}</p></div><img src={qrUrl(marketUrl(activeProducts))} alt="QR Code" className="h-24 w-24 rounded-2xl bg-white p-2" /></div></div> : <div className="mx-auto max-w-[420px] overflow-hidden rounded-[32px] bg-white text-slate-950 shadow-2xl"><div className="bg-orange-500 px-6 py-5 text-white"><p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p><h3 className="mt-3 text-3xl font-black leading-tight">{selected.name}</h3><p className="mt-2 text-sm text-white/80">{selected.storeName}</p></div><div className="p-5"><div className="overflow-hidden rounded-3xl bg-slate-100">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-[360px] w-full object-cover" /> : null}</div><div className="mt-5 rounded-3xl bg-orange-50 p-5"><p className="text-3xl font-black text-orange-600">{selected.price || 'Shop now'}</p><p className="mt-2 text-sm leading-6 text-slate-600">{message}</p></div><div className="mt-6 flex items-center justify-between gap-4"><div><p className="text-xl font-bold">Scan to buy now</p><p className="mt-2 text-sm text-slate-500">Verified sellers • Secure checkout</p></div><img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-2" /></div></div></div>}
      </div>
    </div>
  );
}
