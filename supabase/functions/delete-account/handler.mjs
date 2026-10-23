// Authenticate on the server; never accept a user ID supplied by the caller.
export function createDeleteAccountHandler(admin) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store'
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Authentication required' });
    try {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return reply(401, { error: 'Authentication required' });
      const body = await request.json().catch(() => ({}));
      if (body.confirm !== 'DELETE_MY_ACCOUNT') return reply(400, { error: 'Confirmation required' });
      // A database trigger removes songs, profile and visits in this transaction.
      const deleted = await admin.auth.admin.deleteUser(data.user.id);
      if (deleted.error) return reply(500, { error: 'Account deletion failed. Please retry or contact support.' });
      return reply(200, { deleted: true });
    } catch {
      return reply(500, { error: 'Account deletion failed. Please retry or contact support.' });
    }
  };
}
