import { handleAdmin } from '@/lib/api';
export async function GET(req:Request){return handleAdmin(req,['super_admin','store_admin','support','analyst'],'store.deliveries.read',[{id:'del_1',name:'200 OK'}])}
export async function POST(req:Request){return handleAdmin(req,['super_admin','store_admin','moderator'],'store.deliveries.write',[{id:'del_1'}])}
