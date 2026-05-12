import { handleAdmin } from '@/lib/api';
export async function GET(req:Request){return handleAdmin(req,['super_admin','store_admin','support','analyst'],'store.mapping.read',[{id:'map_1',name:'sku -> variant_id'}])}
export async function POST(req:Request){return handleAdmin(req,['super_admin','store_admin','moderator'],'store.mapping.write',[{id:'map_1'}])}
