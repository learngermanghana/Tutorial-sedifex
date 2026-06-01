import { NextResponse } from 'next/server';

type ProductContext = {
  page?: unknown;
  itemPath?: unknown;
  itemType?: unknown;
  storeId?: unknown;
  name?: unknown;
  price?: unknown;
  description?: unknown;
  category?: unknown;
};

type ProductAgentBody = {
  command?: unknown;
  context?: ProductContext;
};

type AgentField = 'name' | 'price' | 'description';

type AgentChange = {
  field: AgentField;
  label: string;
  current: string;
  value: string;
};

const EXAMPLES = [
  'Change the price to 150',
  'Make this product name more professional',
  'Write a short description for this item',
  'Rename it to Luxury Facial Treatment and improve the description',
];

function clean(value: unknown, max = 600) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeName(value: string) {
  return titleCase(value.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 90);
}

function extractQuotedName(command: string) {
  const quoted = command.match(/["“”']([^"“”']{2,90})["“”']/)?.[1];
  if (quoted) return normalizeName(quoted);

  const renameMatch = command.match(/(?:rename|name|call|change\s+(?:the\s+)?name\s+to)\s+(?:it\s+|this\s+|to\s+)?(.+?)(?:\s+and\s+|\s+with\s+|\s+for\s+|$)/i)?.[1];
  if (!renameMatch) return '';

  const cleaned = renameMatch.replace(/^(?:to|as)\s+/i, '').trim();
  if (!cleaned || cleaned.length < 2) return '';
  return normalizeName(cleaned);
}

function extractPrice(command: string) {
  const priceMatch = command.match(/(?:price|amount|cost|fee)\D{0,18}(\d[\d,]*(?:\.\d{1,2})?)/i) || command.match(/(?:ghs|₵|cedis?)\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (!priceMatch) return '';

  const amount = Number(priceMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount < 0) return '';
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2);
}

function wantsName(command: string) {
  return /\b(name|rename|title|professional|call it|call this)\b/i.test(command);
}

function wantsDescription(command: string) {
  return /\b(description|describe|details|write|improve|better|market|caption|summary)\b/i.test(command);
}

function wantsPrice(command: string) {
  return /\b(price|amount|cost|fee|ghs|cedis?|₵)\b/i.test(command);
}

function itemNoun(type: string) {
  if (type === 'service') return 'service';
  if (type === 'course') return 'course';
  return 'product';
}

function makeProfessionalName(currentName: string, type: string, category: string) {
  const base = normalizeName(currentName || category || itemNoun(type));
  if (!base || base.toLowerCase() === 'untitled item') return type === 'service' ? 'Professional Service Package' : type === 'course' ? 'Professional Training Course' : 'Quality Product';

  const lower = base.toLowerCase();
  if (/\b(luxury|premium|professional|signature|classic)\b/i.test(base)) return base;
  if (type === 'service') return `Professional ${base}`.slice(0, 90);
  if (type === 'course') return `${base} Training Course`.replace(/Course Training Course$/i, 'Training Course').slice(0, 90);
  if (lower.length < 18) return `Premium ${base}`.slice(0, 90);
  return base;
}

function makeDescription(name: string, type: string, category: string) {
  const itemName = normalizeName(name || category || itemNoun(type));
  if (type === 'service') {
    return `${itemName} is a professional service designed to give customers a smooth, reliable experience with clear results and careful attention to detail.`;
  }
  if (type === 'course') {
    return `${itemName} helps learners build practical skills through guided lessons, hands-on practice, and clear support from start to finish.`;
  }
  return `${itemName} is a quality ${category ? category.toLowerCase() : 'item'} selected to give customers good value, a clean shopping experience, and reliable everyday use.`;
}

function sameValue(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function addChange(changes: AgentChange[], field: AgentField, label: string, current: string, value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue || sameValue(current, trimmedValue)) return;
  changes.push({ field, label, current, value: trimmedValue });
}

function isAllowedRole(role?: string) {
  return role === 'super_admin' || role === 'ops_admin' || role === 'store_admin' || role === 'support';
}

function cookieValue(req: Request, name: string) {
  return req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split('=')[1];
}

export async function POST(req: Request) {
  const role = cookieValue(req, 'sedifex_admin_role');
  if (!isAllowedRole(role)) {
    return NextResponse.json({ ok: false, error: 'Only Sedifex admins can use Ask Sedifex product edits.', currentRole: role || null }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as ProductAgentBody | null;
    const command = clean(body?.command, 500);
    const context = body?.context || {};

    if (!command) {
      return NextResponse.json({ ok: false, mode: 'unsupported', message: 'Tell Ask Sedifex what to change first.', examples: EXAMPLES }, { status: 400 });
    }

    const name = clean(context.name, 160);
    const price = clean(context.price, 80);
    const description = clean(context.description, 700);
    const category = clean(context.category, 120);
    const itemType = clean(context.itemType, 40) || 'product';
    const itemPath = clean(context.itemPath, 220);

    const supportedIntent = wantsName(command) || wantsPrice(command) || wantsDescription(command);
    if (!supportedIntent) {
      return NextResponse.json({
        ok: false,
        mode: 'unsupported',
        message: 'This first Ask Sedifex release only prepares product name, price, and description edits. It will not touch stock, orders, payments, bookings, or settlements yet.',
        examples: EXAMPLES,
      });
    }

    const changes: AgentChange[] = [];
    const priceValue = wantsPrice(command) ? extractPrice(command) : '';
    if (priceValue) addChange(changes, 'price', 'Price', price, priceValue);

    const directName = wantsName(command) ? extractQuotedName(command) : '';
    const proposedName = directName || (wantsName(command) ? makeProfessionalName(name, itemType, category) : '');
    if (proposedName) addChange(changes, 'name', 'Product name', name, proposedName);

    if (wantsDescription(command)) {
      const descriptionName = proposedName || name || category;
      addChange(changes, 'description', 'Description', description, makeDescription(descriptionName, itemType, category));
    }

    if (changes.length === 0) {
      return NextResponse.json({
        ok: false,
        mode: 'unsupported',
        message: 'I understood the field, but there was no new value to apply. Try giving a clear price or ask me to improve the name or description.',
        examples: EXAMPLES,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: 'product_fields',
      message: 'I prepared safe product field changes. Review them before applying or saving.',
      itemPath,
      changes,
    });
  } catch (error) {
    console.error('[ask-sedifex-product-agent] failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Ask Sedifex could not prepare that edit.' }, { status: 500 });
  }
}
