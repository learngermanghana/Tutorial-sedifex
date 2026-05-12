import { handleAdmin } from '@/lib/api';
export async function GET(req:Request){return handleAdmin(req,['super_admin','store_admin','support','analyst'],'store.clients.read',[{id:'client_1',name:'POS Connector'}])}
export async function POST(req:Request){return handleAdmin(req,['super_admin','store_admin','moderator'],'store.clients.write',[{id:'client_1'}])}
