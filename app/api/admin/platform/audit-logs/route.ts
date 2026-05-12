import { handleAdmin } from '@/lib/api'; import { auditLogs } from '@/lib/mock-data';
export async function GET(req:Request){return handleAdmin(req,['super_admin','ops_admin','analyst'],'platform.audit.read',auditLogs)}
