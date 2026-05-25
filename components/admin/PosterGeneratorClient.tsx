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

type TemplateKey = 'bigDeals' | 'market' | 'beauty' | 'flash' | 'minimal' | 'dark' | 'collage';
type PlatformKey = 'instagram' | 'tiktok' | 'whatsapp' | 'telegram' | 'facebook' | 'generic';
type ExportFormat = 'png' | 'jpeg' | 'svg';

type PosterTemplate = {
  key: TemplateKey;
  name: string;
  description: string;
  accent: string;
  accentSoft: string;
  dark: string;
  light: string;
  theme: 'light' | 'dark';
  mode?: 'single' | 'collage';
};

const DEFAULT_MESSAGE = 'Same-day delivery for orders placed before 4PM';
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1350;

const PLATFORMS: { key: PlatformKey; name: string; hint: string }[] = [
  { key: 'instagram', name: 'Instagram', hint: 'Comment LINK or tap link in bio' },
  { key: 'tiktok', name: 'TikTok', hint: 'Comment LINK for direct order' },
  { key: 'whatsapp', name: 'WhatsApp', hint: 'Direct product link included' },
  { key: 'telegram', name: 'Telegram', hint: 'Clickable link included' },
  { key: 'facebook', name: 'Facebook', hint: 'Clickable link included' },
  { key: 'generic', name: 'Generic', hint: 'Works anywhere' },
];

const TEMPLATES: PosterTemplate[] = [
  { key: 'bigDeals', name: 'Shop Local Big Deals', description: 'Full Sedifex Market campaign style', accent: '#ff6a00', accentSoft: '#fff7ed', dark: '#064e3b', light: '#ffffff', theme: 'light' },
  { key: 'market', name: 'Sedifex Market', description: 'Clean orange marketplace style', accent: '#ff7a00', accentSoft: '#fff7ed', dark: '#0f172a', light: '#ffffff', theme: 'light' },
  { key: 'beauty', name: 'Beauty Glow', description: 'Soft pink style for skincare, makeup, spa', accent: '#db2777', accentSoft: '#fdf2f8', dark: '#4a044e', light: '#ffffff', theme: 'light' },
  { key: 'flash', name: 'Flash Sale', description: 'Bold yellow promo style for deals', accent: '#facc15', accentSoft: '#fef9c3', dark: '#18181b', light: '#ffffff', theme: 'dark' },
  { key: 'minimal', name: 'Clean White', description: 'Simple premium product showcase', accent: '#2563eb', accentSoft: '#eff6ff', dark: '#0f172a', light: '#ffffff', theme: 'light' },
  { key: 'dark', name: 'Premium Dark', description: 'High contrast luxury poster', accent: '#f97316', accentSoft: '#1f2937', dark: '#020617', light: '#ffffff', theme: 'dark' },
  { key: 'collage', name: 'Product Collage', description: 'Show 2–4 products in one flyer', accent: '#ff7a00', accentSoft: '#fff7ed', dark: '#0f172a', light: '#ffffff', theme: 'light', mode: 'collage' },
];

function qrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sedifex-poster';
}

function marketUrl(products: PosterProduct[]) {
  const firstStore = products[0]?.storeName || '';
  return firstStore ? `https://www.sedifexmarket.com/products?search=${encodeURIComponent(firstStore)}` : 'https://www.sedifexmarket.com/products';
}

function activeUrl(product: PosterProduct, products: PosterProduct[], template: PosterTemplate) {
  return template.mode === 'collage' ? marketUrl(products) : product.productUrl;
}

function platformCallToAction(platform: PlatformKey, url: string) {
  if (platform === 'instagram') return 'Comment LINK or tap the link in bio to order 👆';
  if (platform === 'tiktok') return 'Comment “LINK” and we’ll send the order link directly 📩';
  if (platform === 'whatsapp') return `Order here: ${url}`;
  if (platform === 'telegram') return `Tap to order on Sedifex Market: ${url}`;
  if (platform === 'facebook') return `Shop now on Sedifex Market: ${url}`;
  return `Scan the QR code or shop here: ${url}`;
}

function caption(product: PosterProduct, message: string, template: PosterTemplate, products: PosterProduct[], platform: PlatformKey) {
  const cta = platformCallToAction(platform, activeUrl(product, products, template));
  if (template.mode === 'collage') {
    const productLines = products.map((item, index) => `${index + 1}. ${item.name}${item.price ? ` — ${item.price}` : ''}`).join('\n');
    return `Fresh picks on Sedifex Market 🛒\n\n${productLines}\n\n✔ Verified sellers\n✔ Secure checkout\n✔ ${message}\n\n${cta}\n\nPowered by Sedifex Market\n#SedifexMarket #ShopOnlineGhana #BuyOnline`;
  }
  const opener = template.key === 'flash' ? 'Limited deal on Sedifex Market ⚡' : template.key === 'beauty' ? 'Glow up with verified beauty products ✨' : 'Available now on Sedifex Market 🛒';
  return `${product.name}\n\n${opener}\n✔ Verified seller\n✔ Secure checkout\n✔ ${message}\n\n${cta}\n\nPowered by Sedifex Market\n#SedifexMarket #ShopOnlineGhana #BuyOnline`;
}

function productCardSvg(product: PosterProduct, x: number, y: number, width: number, height: number, template: PosterTemplate) {
  const safeName = escapeSvg(product.name.slice(0, 34));
  const safePrice = escapeSvg(product.price || 'Shop now');
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="#ffffff" /><rect x="${x + 18}" y="${y + 18}" width="${width - 36}" height="${height - 145}" rx="22" fill="#f8fafc" /><image href="${product.imageUrl}" x="${x + 28}" y="${y + 28}" width="${width - 56}" height="${height - 165}" preserveAspectRatio="xMidYMid meet" /><text x="${x + 24}" y="${y + height - 88}" font-size="26" font-weight="900" fill="#0f172a">${safeName}</text><text x="${x + 24}" y="${y + height - 43}" font-size="30" font-weight="900" fill="${template.accent}">${safePrice}</text>`;
}

function buildBigDealsSvg(product: PosterProduct, message: string) {
  const safeName = escapeSvg(product.name);
  const safePrice = escapeSvg(product.price || 'Shop now');
  const safeMessage = escapeSvg(message);
  const qr = qrUrl(product.productUrl);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
    <defs>
      <linearGradient id="orangeBg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff5400"/><stop offset="1" stop-color="#ff8a00"/></linearGradient>
      <linearGradient id="greenBg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#009a44"/><stop offset="1" stop-color="#006b3f"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#052e16" flood-opacity="0.35"/></filter>
    </defs>
    <rect width="1080" height="1350" fill="#0b3f2a"/>
    <path d="M0 0H620L520 1350H0Z" fill="url(#orangeBg)"/>
    <path d="M520 0H1080V1350H430Z" fill="url(#greenBg)"/>
    <circle cx="930" cy="150" r="130" fill="#ffffff" opacity="0.13"/>
    <circle cx="960" cy="190" r="7" fill="#ffffff" opacity="0.95"/><circle cx="990" cy="190" r="7" fill="#ffffff" opacity="0.95"/><circle cx="1020" cy="190" r="7" fill="#ffffff" opacity="0.95"/><circle cx="960" cy="220" r="7" fill="#ffffff" opacity="0.95"/><circle cx="990" cy="220" r="7" fill="#ffffff" opacity="0.95"/><circle cx="1020" cy="220" r="7" fill="#ffffff" opacity="0.95"/>
    <text x="78" y="112" font-size="44" font-weight="900" fill="#ffffff">Sedifex</text><text x="80" y="150" font-size="28" font-weight="700" fill="#fff7ed">Market</text>
    <text x="78" y="300" font-size="62" font-weight="950" fill="#ffffff">Shop Local,</text><text x="78" y="370" font-size="62" font-weight="950" fill="#ffffff">Big Deals</text>
    <text x="78" y="430" font-size="31" font-weight="800" fill="#fff7ed">Trusted Ghana stores,</text><text x="78" y="470" font-size="31" font-weight="800" fill="#fff7ed">delivered to you.</text>
    <g font-size="25" font-weight="900" fill="#064e3b">
      <rect x="78" y="530" width="360" height="54" rx="27" fill="#ffd43b"/><text x="133" y="566">Trusted Ghana Stores</text><text x="98" y="566">✓</text>
      <rect x="78" y="602" width="360" height="54" rx="27" fill="#ffd43b"/><text x="133" y="638">Secure Checkout</text><text x="98" y="638">🔒</text>
      <rect x="78" y="674" width="390" height="64" rx="32" fill="#ffd43b"/><text x="133" y="700">Same-day Delivery</text><text x="133" y="728" font-size="20">for orders before 4PM</text><text x="98" y="711">🚚</text>
      <rect x="78" y="756" width="360" height="54" rx="27" fill="#ffd43b"/><text x="133" y="792">Verified Sellers</text><text x="98" y="792">✓</text>
    </g>
    <rect x="78" y="875" width="285" height="78" rx="39" fill="#ffffff"/><text x="112" y="925" font-size="38" font-weight="950" fill="#0f172a">SHOP NOW</text><circle cx="327" cy="914" r="24" fill="#064e3b"/><text x="316" y="927" font-size="32" font-weight="950" fill="#ffffff">›</text>
    <text x="78" y="1030" font-size="26" font-weight="800" fill="#fff7ed">#ShopWithSedifex 🇬🇭</text>
    <ellipse cx="725" cy="1060" rx="250" ry="42" fill="#ffffff" opacity="0.94"/>
    <rect x="545" y="245" width="370" height="570" rx="36" fill="#ffffff" opacity="0.96" filter="url(#shadow)"/>
    <image href="${product.imageUrl}" x="565" y="270" width="330" height="520" preserveAspectRatio="xMidYMid meet"/>
    <text x="560" y="865" text-anchor="middle" font-size="34" font-weight="900" fill="#ffffff" opacity="0.92">${safeName}</text>
    <text x="725" y="965" text-anchor="middle" font-size="58" font-weight="950" fill="#ffffff">${safePrice}</text>
    <text x="725" y="1016" text-anchor="middle" font-size="28" font-weight="800" fill="#fff7ed">${safeMessage}</text>
    <rect x="828" y="920" width="165" height="205" rx="22" fill="#ffffff"/><image href="${qr}" x="845" y="938" width="132" height="132"/><text x="910" y="1100" text-anchor="middle" font-size="18" font-weight="950" fill="#064e3b">SCAN TO BUY</text>
    <rect x="0" y="1165" width="1080" height="92" fill="#064e3b"/>
    <text x="120" y="1220" font-size="26" font-weight="900" fill="#ffffff">Safe. Simple.</text><text x="350" y="1220" font-size="26" font-weight="900" fill="#ffffff">Shop local. Support Ghana.</text><text x="760" y="1220" font-size="26" font-weight="900" fill="#ffffff">Fast delivery. Same day.</text>
    <rect x="0" y="1257" width="1080" height="93" fill="#f15a00"/><text x="78" y="1315" font-size="26" font-weight="900" fill="#ffffff">🌐 www.sedifexmarket.com</text><text x="745" y="1315" font-size="26" font-weight="900" fill="#ffffff">Powered by Sedifex</text>
  </svg>`;
}

function buildCollageSvg(products: PosterProduct[], message: string, template: PosterTemplate) {
  const chosen = products.slice(0, 4);
  const qr = qrUrl(marketUrl(chosen));
  const safeMessage = escapeSvg(message);
  const cards = chosen.map((product, index) => {
    const positions = [{ x: 90, y: 345 }, { x: 555, y: 345 }, { x: 90, y: 755 }, { x: 555, y: 755 }];
    const p = positions[index];
    return productCardSvg(product, p.x, p.y, 435, 360, template);
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}"><rect width="1080" height="1350" fill="${template.accent}" /><circle cx="920" cy="100" r="210" fill="#ffffff" opacity="0.18" /><circle cx="130" cy="1240" r="260" fill="#ffffff" opacity="0.14" /><text x="90" y="125" font-size="42" font-weight="800" fill="#ffffff">Sedifex Market</text><text x="90" y="205" font-size="78" font-weight="950" fill="#ffffff">Fresh Picks</text><text x="90" y="260" font-size="34" fill="#fff7ed">Shop verified products online</text>${cards}<rect x="90" y="1160" width="610" height="110" rx="30" fill="#0f172a" /><text x="130" y="1210" font-size="34" font-weight="900" fill="#ffffff">${safeMessage}</text><text x="130" y="1250" font-size="24" fill="#cbd5e1">Scan QR to shop these products</text><image href="${qr}" x="770" y="1125" width="220" height="220" /></svg>`;
}

function buildPosterSvg(product: PosterProduct, message: string, template: PosterTemplate, products: PosterProduct[]) {
  if (template.key === 'bigDeals') return buildBigDealsSvg(product, message);
  if (template.mode === 'collage') return buildCollageSvg(products, message, template);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${background}" /><stop offset="100%" stop-color="${template.accent}" /></linearGradient></defs><rect width="1080" height="1350" fill="url(#bg)" /><rect x="60" y="60" width="960" height="1230" rx="40" fill="${card}" /><rect x="100" y="105" width="320" height="54" rx="27" fill="${badgeFill}" /><text x="130" y="141" font-size="22" font-weight="800" fill="${template.accent}">${promoText}</text><text x="100" y="220" font-size="42" font-weight="700" fill="${template.accent}">Sedifex Market</text><text x="100" y="290" font-size="68" font-weight="900" fill="${primaryText}">${safeName}</text><text x="100" y="345" font-size="34" fill="${secondaryText}">${safeStore}</text><rect x="100" y="390" width="880" height="470" rx="34" fill="${template.theme === 'dark' ? '#111827' : '#f8fafc'}" /><image href="${product.imageUrl}" x="135" y="420" width="810" height="410" preserveAspectRatio="xMidYMid meet" /><rect x="100" y="900" width="880" height="150" rx="30" fill="${badgeFill}" /><text x="140" y="965" font-size="54" font-weight="900" fill="${template.accent}">${safePrice}</text><text x="140" y="1018" font-size="31" fill="${secondaryText}">${safeMessage}</text><rect x="100" y="1085" width="560" height="165" rx="30" fill="${template.theme === 'dark' ? '#111827' : '#f8fafc'}" /><text x="140" y="1148" font-size="43" font-weight="800" fill="${primaryText}">Scan to buy now</text><text x="140" y="1200" font-size="28" fill="${secondaryText}">Secure checkout • Verified sellers</text><text x="140" y="1235" font-size="22" fill="${secondaryText}">${safeTemplateName} template</text><image href="${qr}" x="740" y="1060" width="220" height="220" /><rect x="100" y="1265" width="480" height="60" rx="30" fill="${footerFill}" /><text x="140" y="1304" font-size="27" font-weight="800" fill="#ffffff">www.sedifexmarket.com</text></svg>`;
}

async function inlineSvgImages(svg: string) {
  const hrefs = Array.from(svg.matchAll(/href="(https?:\/\/[^"]+)"/g)).map((match) => match[1]);
  let hydratedSvg = svg;
  await Promise.all(hrefs.map(async (href) => {
    try {
      const response = await fetch(`/api/admin/poster-assets?url=${encodeURIComponent(href)}`);
      if (!response.ok) return;
      const data = await response.json() as { dataUrl?: string };
      if (data.dataUrl) hydratedSvg = hydratedSvg.split(href).join(data.dataUrl);
    } catch {
      // Keep the remote URL. SVG fallback still works even if a proxy request fails.
    }
  }));
  return hydratedSvg;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function rasterizeSvg(svg: string, filename: string, format: Exclude<ExportFormat, 'svg'>) {
  const hydratedSvg = await inlineSvgImages(svg);
  const svgBlob = new Blob([hydratedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_WIDTH;
    canvas.height = POSTER_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    ctx.drawImage(image, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((nextBlob) => nextBlob ? resolve(nextBlob) : reject(new Error('Unable to create image file.')), mime, format === 'jpeg' ? 0.92 : undefined));
    saveBlob(blob, `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function PosterGeneratorClient({ products }: { products: PosterProduct[] }) {
  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [selectedCollageIds, setSelectedCollageIds] = useState<string[]>(products.slice(0, 4).map((item) => item.id));
  const [deliveryMessage, setDeliveryMessage] = useState(DEFAULT_MESSAGE);
  const [templateKey, setTemplateKey] = useState<TemplateKey>('bigDeals');
  const [platformKey, setPlatformKey] = useState<PlatformKey>('instagram');
  const [copyMessage, setCopyMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const selected = useMemo(() => products.find((item) => item.id === selectedId) || products[0], [products, selectedId]);
  const selectedTemplate = useMemo(() => TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0], [templateKey]);
  const selectedPlatform = useMemo(() => PLATFORMS.find((item) => item.key === platformKey) || PLATFORMS[0], [platformKey]);
  const collageProducts = useMemo(() => selectedCollageIds.map((id) => products.find((item) => item.id === id)).filter(Boolean).slice(0, 4) as PosterProduct[], [products, selectedCollageIds]);
  const activeProducts = selectedTemplate.mode === 'collage' ? collageProducts : [selected].filter(Boolean) as PosterProduct[];
  const generatedCaption = useMemo(() => selected ? caption(selected, deliveryMessage, selectedTemplate, activeProducts, platformKey) : '', [selected, deliveryMessage, selectedTemplate, activeProducts, platformKey]);

  function toggleCollageProduct(productId: string) {
    setSelectedCollageIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : current.length >= 4 ? [...current.slice(1), productId] : [...current, productId]);
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(generatedCaption);
    setCopyMessage(`Copied ${selectedPlatform.name} caption`);
  }

  async function downloadPoster(format: ExportFormat) {
    if (!selected || exporting) return;
    const productsForPoster = activeProducts.length ? activeProducts : [selected];
    const svg = buildPosterSvg(selected, deliveryMessage, selectedTemplate, productsForPoster);
    const baseName = `${selectedTemplate.mode === 'collage' ? 'sedifex-product-collage' : slug(selected.name)}-${selectedTemplate.key}-poster`;
    setExporting(format);
    setExportMessage('');
    try {
      if (format === 'svg') saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName}.svg`);
      else await rasterizeSvg(svg, baseName, format);
      setExportMessage(`Downloaded ${format.toUpperCase()} poster`);
    } catch {
      setExportMessage('PNG/JPEG export could not load one product image. Try SVG, or check that the product image URL is public.');
    } finally {
      setExporting(null);
    }
  }

  if (!selected) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">No verified, poster-ready products available yet.</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose product</label><select value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose template</label><div className="grid gap-3 sm:grid-cols-2">{TEMPLATES.map((template) => <button key={template.key} type="button" onClick={() => setTemplateKey(template.key)} className={`rounded-2xl border p-4 text-left transition ${templateKey === template.key ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200'}`}><span className="mb-3 block h-3 w-16 rounded-full" style={{ background: template.accent }} /><span className="block text-sm font-bold text-slate-950">{template.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{template.description}</span></button>)}</div></div>
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Platform caption style</label><select value={platformKey} onChange={(event) => setPlatformKey(event.target.value as PlatformKey)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">{PLATFORMS.map((platform) => <option key={platform.key} value={platform.key}>{platform.name} — {platform.hint}</option>)}</select><p className="mt-2 text-xs text-slate-500">{selectedPlatform.hint}</p></div>
        {selectedTemplate.mode === 'collage' ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Pick 2–4 products for collage</label><div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{products.map((product) => { const checked = selectedCollageIds.includes(product.id); return <button key={product.id} type="button" onClick={() => toggleCollageProduct(product.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${checked ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'}`}><span className={`h-4 w-4 rounded border ${checked ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'}`} /><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{product.name}</span><span className="block truncate text-xs text-slate-500">{product.price || 'No price'}</span></span></button>; })}</div><p className="mt-3 text-xs text-slate-500">Selected: {selectedCollageIds.length}/4. If you choose more than 4, the oldest selected product is replaced.</p></div> : null}
        <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery message</label><input value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" /></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><QrCode className="h-4 w-4 text-orange-500" /> Auto QR code</div><p className="mt-2 text-sm leading-6 text-slate-600">The QR code links to the selected product or to a marketplace product search for collage flyers.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4 text-orange-500" /> {selectedPlatform.name} caption</div><textarea readOnly value={generatedCaption} rows={10} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700" /><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={copyCaption} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800">Copy caption</button>{copyMessage ? <span className="text-xs font-semibold text-emerald-600">{copyMessage}</span> : null}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Download poster</p><div className="mt-3 flex flex-wrap gap-3"><button disabled={Boolean(exporting)} onClick={() => downloadPoster('png')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"><Download className="h-4 w-4" /> {exporting === 'png' ? 'Creating PNG…' : 'Download PNG'}</button><button disabled={Boolean(exporting)} onClick={() => downloadPoster('jpeg')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"><Download className="h-4 w-4" /> {exporting === 'jpeg' ? 'Creating JPEG…' : 'Download JPEG'}</button><button disabled={Boolean(exporting)} onClick={() => downloadPoster('svg')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">SVG backup</button></div>{exportMessage ? <p className="mt-3 text-xs font-semibold text-slate-600">{exportMessage}</p> : null}</div>
      </div>
      <div className="rounded-[32px] border border-slate-200 bg-slate-100 p-5">
        {selectedTemplate.mode === 'collage' ? <div className="mx-auto max-w-[420px] overflow-hidden rounded-[32px] bg-orange-500 p-6 text-white shadow-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p><h3 className="mt-3 text-4xl font-black leading-tight">Fresh Picks</h3><p className="mt-2 text-sm text-orange-100">Shop verified products online</p><div className="mt-6 grid grid-cols-2 gap-3">{(activeProducts.length ? activeProducts : [selected]).slice(0, 4).map((product) => <div key={product.id} className="rounded-3xl bg-white p-3 text-slate-950">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-36 w-full rounded-2xl bg-slate-100 object-cover" /> : <div className="flex h-36 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">No image</div>}<p className="mt-3 truncate text-sm font-black">{product.name}</p><p className="mt-1 text-sm font-black text-orange-500">{product.price || 'Shop now'}</p></div>)}</div><div className="mt-6 flex items-center justify-between gap-4 rounded-3xl bg-slate-950 p-4"><div><p className="text-lg font-black">Scan to shop</p><p className="mt-1 text-xs text-slate-300">{deliveryMessage}</p></div><img src={qrUrl(marketUrl(activeProducts))} alt="QR Code" className="h-24 w-24 rounded-2xl bg-white p-2" /></div></div> : selectedTemplate.key === 'bigDeals' ? <div className="mx-auto max-w-[420px] overflow-hidden rounded-[28px] bg-orange-500 text-white shadow-2xl"><div className="grid min-h-[560px] grid-cols-[0.48fr_0.52fr]"><div className="p-5"><p className="text-xl font-black">Sedifex</p><p className="text-xs font-bold">Market</p><h3 className="mt-12 text-3xl font-black leading-tight">Shop Local,<br />Big Deals</h3><p className="mt-3 text-sm font-bold text-orange-100">Trusted Ghana stores, delivered to you.</p><div className="mt-6 space-y-2 text-[10px] font-black text-green-900"><p className="rounded-full bg-yellow-300 px-3 py-2">✓ Trusted Ghana Stores</p><p className="rounded-full bg-yellow-300 px-3 py-2">🔒 Secure Checkout</p><p className="rounded-full bg-yellow-300 px-3 py-2">🚚 Same-day Delivery</p><p className="rounded-full bg-yellow-300 px-3 py-2">✓ Verified Sellers</p></div></div><div className="bg-green-700 p-5"><div className="mt-20 rounded-3xl bg-white p-4 shadow-2xl">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-64 w-full object-contain" /> : <div className="flex h-64 items-center justify-center text-xs text-slate-400">No image</div>}</div><p className="mt-5 text-center text-3xl font-black">{selected.price || 'Shop now'}</p><div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-3 text-green-900"><span className="text-xs font-black">SCAN TO BUY</span><img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-20 w-20" /></div></div></div><div className="bg-green-900 px-5 py-3 text-xs font-bold">Safe. Simple. • Shop local. Support Ghana. • Fast delivery.</div><div className="bg-orange-600 px-5 py-3 text-xs font-bold">www.sedifexmarket.com <span className="float-right">Powered by Sedifex</span></div></div> : <div className={`mx-auto max-w-[420px] overflow-hidden rounded-[32px] shadow-2xl ${selectedTemplate.theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-950'}`}><div className="px-6 py-5 text-white" style={{ background: selectedTemplate.accent }}><p className="text-sm font-semibold uppercase tracking-[0.2em]">Sedifex Market</p><h3 className="mt-3 text-3xl font-black leading-tight">{selected.name}</h3><p className="mt-2 text-sm text-white/80">{selected.storeName}</p></div><div className="p-5"><div className={`overflow-hidden rounded-3xl ${selectedTemplate.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-[360px] w-full object-cover" /> : <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">No product image</div>}</div><div className="mt-5 rounded-3xl p-5" style={{ background: selectedTemplate.theme === 'dark' ? '#111827' : selectedTemplate.accentSoft }}><p className="text-3xl font-black" style={{ color: selectedTemplate.accent }}>{selected.price || 'Shop now'}</p><p className={`mt-2 text-sm leading-6 ${selectedTemplate.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{deliveryMessage}</p></div><div className="mt-6 flex items-center justify-between gap-4"><div><p className="text-xl font-bold">Scan to buy now</p><p className={`mt-2 text-sm ${selectedTemplate.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Verified sellers • Secure checkout</p><p className={`mt-1 text-xs ${selectedTemplate.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{selectedTemplate.name}</p></div><img src={qrUrl(selected.productUrl)} alt="QR Code" className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-2" /></div></div></div>}
      </div>
    </div>
  );
}
