'use client';

import { Trash2 } from 'lucide-react';

type DeleteCustomerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  customerPath: string;
  customerName: string;
  compact?: boolean;
};

export default function DeleteCustomerForm({ action, customerPath, customerName, compact = false }: DeleteCustomerFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(`Delete customer "${customerName}"? This removes ${customerPath} from Firestore. This cannot be undone.`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="customerPath" value={customerPath} />
      <input type="hidden" name="confirmDelete" value="DELETE_CUSTOMER" />
      <button
        type="submit"
        className={compact
          ? 'inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100'
          : 'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-500'}
      >
        <Trash2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        Delete
      </button>
    </form>
  );
}
