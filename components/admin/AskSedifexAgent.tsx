'use client';

import { FormEvent, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Bot, CheckCircle2, Send, Sparkles, X } from 'lucide-react';

type ProductContext = {
  page: string;
  itemPath: string;
  itemType: string;
  storeId: string;
  name: string;
  price: string;
  description: string;
  category: string;
};

type AgentField = 'name' | 'price' | 'description';

type AgentChange = {
  field: AgentField;
  label: string;
  current: string;
  value: string;
};

type AgentResponse = {
  ok: boolean;
  mode?: 'product_fields' | 'unsupported';
  message?: string;
  itemPath?: string;
  changes?: AgentChange[];
  examples?: string[];
  error?: string;
};

const EXAMPLES = [
  'Change the price to 150',
  'Make this product name more professional',
  'Write a short description for this item',
  'Rename it to Luxury Facial Treatment and improve the description',
];

function fieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value.trim();
  }
  return '';
}

function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function formHasProductFields(form: HTMLFormElement) {
  return Boolean(form.elements.namedItem('name') && form.elements.namedItem('price') && form.elements.namedItem('description'));
}

function isVisible(form: HTMLFormElement) {
  const rect = form.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
}

function findProductForm() {
  if (typeof document === 'undefined') return null;

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeForm = active?.closest('form');
  if (activeForm instanceof HTMLFormElement && formHasProductFields(activeForm)) return activeForm;

  return Array.from(document.querySelectorAll<HTMLFormElement>('form')).find((form) => formHasProductFields(form) && isVisible(form)) ?? null;
}

function readProductContext(page: string): ProductContext | null {
  const form = findProductForm();
  if (!form) return null;

  const itemPath = form.textContent?.match(/\b(?:products|services|courses|catalogItems)\/[^\s]+/)?.[0]?.replace(/[.,;:)]+$/, '') ?? '';

  return {
    page,
    itemPath,
    itemType: fieldValue(form, 'itemType') || 'product',
    storeId: fieldValue(form, 'storeId'),
    name: fieldValue(form, 'name'),
    price: fieldValue(form, 'price'),
    description: fieldValue(form, 'description'),
    category: fieldValue(form, 'category'),
  };
}

function findMatchingForm(itemPath?: string) {
  const forms = Array.from(document.querySelectorAll<HTMLFormElement>('form')).filter(formHasProductFields);
  if (itemPath) {
    const exact = forms.find((form) => form.textContent?.includes(itemPath));
    if (exact) return exact;
  }
  return findProductForm();
}

export default function AskSedifexAgent() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const productPage = pathname.startsWith('/admin/products');
  const disabledHint = useMemo(() => {
    if (productPage) return 'Click inside a catalog item, then ask me to edit its name, price, or description.';
    return 'Product edits are live first. Booking, reports, sales, and inventory actions can be unlocked later.';
  }, [productPage]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand || loading) return;

    setApplied(false);
    setLoading(true);
    setResult(null);

    try {
      if (!productPage) {
        setResult({
          ok: false,
          mode: 'unsupported',
          message: 'Ask Sedifex is ready as a floating assistant, but this first release only supports product, service, and course field edits on the Products page.',
          examples: EXAMPLES,
        });
        return;
      }

      const context = readProductContext(pathname);
      if (!context) {
        setResult({
          ok: false,
          mode: 'unsupported',
          message: 'I could not find an editable catalog item on this page. Click inside the product, service, or course form you want to edit, then ask again.',
          examples: EXAMPLES,
        });
        return;
      }

      const response = await fetch('/api/admin/ask-sedifex/product-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmedCommand, context }),
      });
      const payload = (await response.json().catch(() => null)) as AgentResponse | null;

      if (!response.ok || !payload) {
        setResult({ ok: false, mode: 'unsupported', message: payload?.error || 'Ask Sedifex could not prepare that edit yet.', examples: EXAMPLES });
        return;
      }

      setResult(payload);
    } catch (error) {
      setResult({ ok: false, mode: 'unsupported', message: error instanceof Error ? error.message : 'Ask Sedifex failed to prepare the edit.', examples: EXAMPLES });
    } finally {
      setLoading(false);
    }
  }

  function applyChanges(submitAfterApply = false) {
    if (!result?.changes?.length) return;
    const form = findMatchingForm(result.itemPath);
    if (!form) {
      setResult({ ...result, ok: false, message: 'I prepared the edit, but I could not find the matching form to apply it. Click inside the item and try again.' });
      return;
    }

    result.changes.forEach((change) => setFieldValue(form, change.field, change.value));
    setApplied(true);

    if (submitAfterApply) {
      form.requestSubmit();
    } else {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-4 bg-slate-950 p-4 text-white">
            <div className="flex gap-3">
              <span className="rounded-2xl bg-indigo-500 p-2 text-white"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h2 className="text-sm font-bold">Ask Sedifex</h2>
                <p className="mt-1 text-xs leading-5 text-slate-300">Product Agent MVP: name, price, and description.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close Ask Sedifex">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-2xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-900">
              {disabledHint}
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Tell Sedifex what to change..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
              />
              <button
                type="submit"
                disabled={loading || !command.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" /> {loading ? 'Preparing edit...' : 'Prepare edit'}
              </button>
            </form>

            {result ? (
              <div className={`rounded-2xl border p-4 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <div className="mb-3 flex items-start gap-2">
                  {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <p className="leading-6">{result.message}</p>
                </div>

                {result.changes?.length ? (
                  <div className="space-y-2">
                    {result.changes.map((change) => (
                      <div key={change.field} className="rounded-xl bg-white/80 p-3 ring-1 ring-black/5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{change.label}</p>
                        <div className="mt-2 grid gap-2 text-xs text-slate-700">
                          <p><span className="font-semibold">Current:</span> {change.current || 'Empty'}</p>
                          <p><span className="font-semibold">New:</span> {change.value}</p>
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => applyChanges(false)} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800">
                        Apply to form
                      </button>
                      <button type="button" onClick={() => applyChanges(true)} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500">
                        Apply & save
                      </button>
                    </div>
                    {applied ? <p className="text-xs font-semibold text-emerald-700">Applied. You can still review the fields before saving if you used Apply to form.</p> : null}
                  </div>
                ) : null}

                {!result.ok && result.examples?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.examples.map((example) => (
                      <button key={example} type="button" onClick={() => setCommand(example)} className="rounded-full bg-white px-3 py-1.5 text-left text-xs font-semibold text-slate-700 ring-1 ring-black/5 hover:bg-slate-50">
                        {example}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-indigo-600"
        aria-expanded={open}
      >
        <Bot className="h-5 w-5" /> Ask Sedifex
      </button>
    </div>
  );
}
