import { handleAdmin } from '@/lib/api';
export async function GET(req:Request){return handleAdmin(req,['super_admin','store_admin','support','analyst'],'store.overview.read',[{id:'overview_1',name:'overview sample'}])}
export async function POST(req:Request){return handleAdmin(req,['super_admin','store_admin','moderator'],'store.overview.write',[{id:'overview_1'}])}
