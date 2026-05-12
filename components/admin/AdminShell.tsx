import type { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import { AdminContextProvider } from './admin-context';

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminContextProvider>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1">
          <AdminTopbar />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </AdminContextProvider>
  );
}
