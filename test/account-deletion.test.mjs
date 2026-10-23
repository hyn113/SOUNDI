import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

function fixture(user = { id: 'authenticated-owner' }, deletionError = null) {
  const deleted = [];
  const handler = createDeleteAccountHandler({ auth: {
    getUser: async token => ({ data: { user: token === 'valid' ? user : null }, error: null }),
    admin: { deleteUser: async id => { deleted.push(id); return { error: deletionError }; } }
  } });
  return { handler, deleted };
}
const request = (token = 'valid', body = { confirm: 'DELETE_MY_ACCOUNT' }) => new Request('https://example.com', {
  method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body)
});
test('invalid or deleted user cannot delete any account', async () => {
  for (const user of [null, { id: 'owner' }]) {
    const { handler, deleted } = fixture(user);
    assert.equal((await handler(request(user ? 'invalid' : 'valid'))).status, 401);
    assert.deepEqual(deleted, []);
  }
});
test('deletion requires explicit confirmation', async () => {
  const { handler, deleted } = fixture();
  assert.equal((await handler(request('valid', {}))).status, 400);
  assert.deepEqual(deleted, []);
});
test('caller cannot supply another user ID', async () => {
  const { handler, deleted } = fixture();
  assert.equal((await handler(request('valid', { confirm: 'DELETE_MY_ACCOUNT', userId: 'victim' }))).status, 200);
  assert.deepEqual(deleted, ['authenticated-owner']);
});
test('database deletion failure does not report success', async () => {
  const { handler } = fixture(undefined, new Error('private database details'));
  const response = await handler(request());
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /private database details/);
});
test('GET requests never delete; CORS preflight succeeds', async () => {
  const { handler, deleted } = fixture();
  assert.equal((await handler(new Request('https://example.com'))).status, 405);
  assert.equal((await handler(new Request('https://example.com', { method: 'OPTIONS' }))).status, 204);
  assert.deepEqual(deleted, []);
});
