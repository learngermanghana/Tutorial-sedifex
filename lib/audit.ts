export async function writeAuditLog(action: string, actorId: string, payload: unknown) {
  console.info('[AUDIT]', JSON.stringify({action, actorId, payload, at: new Date().toISOString()}));
}
