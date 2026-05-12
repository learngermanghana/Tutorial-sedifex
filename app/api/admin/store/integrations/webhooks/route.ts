import { handleAdmin } from '@/lib/api';
export async function GET(req:Request){return handleAdmin(req,['super_admin','store_admin','support','analyst'],'store.webhooks.read',[{id:'wh_1',name:'order.updated'}])}
export async function POST(req:Request){return handleAdmin(req,['super_admin','store_admin','moderator'],'store.webhooks.write',[{id:'wh_1'}])}
