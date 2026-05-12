import { handleAdmin } from '@/lib/api'; import { tenants } from '@/lib/mock-data';
export async function GET(req:Request){return handleAdmin(req,['super_admin','ops_admin'],'platform.tenants.read',tenants)}
export async function POST(req:Request){return handleAdmin(req,['super_admin'],'platform.tenants.write',tenants)}
