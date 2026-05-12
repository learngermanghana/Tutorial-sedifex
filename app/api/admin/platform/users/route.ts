import { handleAdmin } from '@/lib/api'; import { users } from '@/lib/mock-data';
export async function GET(req:Request){return handleAdmin(req,['super_admin','ops_admin','support'],'platform.users.read',users)}
export async function POST(req:Request){return handleAdmin(req,['super_admin','ops_admin'],'platform.users.write',users)}
