export function createAppleRevoker(clientId, clientSecret, fetchApple = fetch) {
  async function post(path, fields) {
    return fetchApple(`https://appleid.apple.com/auth/${path}`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
  }

  return async (code, expectedSubject) => {
    if (!clientId || !clientSecret || !expectedSubject) throw new Error('Apple revocation unavailable');
    const response = await post('token', { grant_type: 'authorization_code', code });
    if (!response.ok) throw new Error('Apple authorization failed');
    const tokens = await response.json();

    // Read the identity from Apple's HTTPS response, never from caller-supplied claims.
    const payload = tokens.id_token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== clientId ||
        claims.sub !== expectedSubject || !tokens.refresh_token) {
      throw new Error('Apple identity did not match');
    }
    const revoked = await post('revoke', { token: tokens.refresh_token, token_type_hint: 'refresh_token' });
    if (!revoked.ok) throw new Error('Apple revocation failed');
  };
}
