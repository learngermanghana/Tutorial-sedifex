'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
const mods=['Overview','Commerce','Customers','Engagement','Integrations','Operations','Settings'];
export function AdminShell({children}:{children:ReactNode}){const p=usePathname();
return <div className='min-h-screen bg-slate-50'><header className='border-b bg-white p-4 flex justify-between'><h1 className='font-semibold'>Sedifex Admin</h1><div className='flex gap-2'><select className='border rounded px-2 py-1'><option>Platform</option><option>Store</option></select><select className='border rounded px-2 py-1'><option>Store A</option><option>Store B</option></select></div></header><div className='flex'><aside className='w-64 border-r bg-white p-3 space-y-2'>{mods.map(m=><div key={m} className='text-sm text-slate-700'>{m}</div>)}<div className='pt-4 space-y-1 text-sm'>{['/(platform)/dashboard','/(platform)/tenants','/(platform)/users','/(platform)/audit-logs','/(store)/overview','/(store)/integrations/clients','/(store)/integrations/webhooks','/(store)/integrations/deliveries','/(store)/integrations/mapping'].map(r=><Link key={r} href={r.replace('/(platform)','').replace('/(store)','')} className={p===r? 'text-blue-600':'text-slate-600'}>{r}</Link>)}</div></aside><main className='flex-1 p-6'>{children}</main></div></div>}
