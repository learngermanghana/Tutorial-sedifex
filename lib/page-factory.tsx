import { DataTable } from '@/components/admin/table';
import { FilterBar } from '@/components/admin/filter-bar';
import { DetailDrawer } from '@/components/admin/detail-drawer';
export function AdminPage({title}:{title:string}){return <div className='space-y-4'><h2 className='text-2xl font-semibold'>{title}</h2><FilterBar/><DataTable columns={['ID','Name','Status']} rows={[[title.slice(0,2),'Sample record','Active']]} /><DetailDrawer title='Details'>Select a row to inspect details, with mutation history and entitlement checks.</DetailDrawer></div>}
