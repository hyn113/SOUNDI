import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppleRevoker } from '../supabase/functions/delete-account/apple-revocation.mjs';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

test('account deletion revokes Apple credentials only after the Apple subject matches', async () => {
  const calls = [];
  const revoke = createAppleRevoker('com.soundi.test', 'test-secret', async (url, request) => {
    calls.push(new URL(url).pathname);
    if (url.endsWith('/revoke')) {
      assert.equal(request.body.get('token'), 'apple-refresh');
      return new Response(null);
    }
    const claims = Buffer.from(JSON.stringify({
      iss: 'https://appleid.apple.com',
      aud: 'com.soundi.test',
      sub: request.body.get('code') === 'correct-code' ? 'apple-owner' : 'another-owner'
    })).toString('base64url');
    return Response.json({ id_token: `header.${claims}.signature`, refresh_token: 'apple-refresh' });
  });
  const handler = createDeleteAccountHandler({ auth: {
    getUser: async () => ({ data: { user: {
      id: 'supabase-owner', identities: [{ provider: 'apple', identity_data: { sub: 'apple-owner' } }]
    } } }),
    admin: { deleteUser: async id => { calls.push(id); return {}; } }
  } }, revoke);
  const remove = code => handler(new Request('https://soundi.test', {
    method: 'POST', headers: { authorization: 'Bearer session' },
    body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT', appleAuthorizationCode: code })
  }));

  assert.equal((await remove()).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await remove('wrong-code')).status, 500);
  assert.deepEqual(calls, ['/auth/token']);
  assert.equal((await remove('correct-code')).status, 200);
  assert.deepEqual(calls.slice(1), ['/auth/token', '/auth/revoke', 'supabase-owner']);
});
