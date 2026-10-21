import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const CHAT_TOKEN_ISSUER = 'chat@system.gserviceaccount.com';
const AUDIENCE = '50813717010';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signChatToken(payload: Record<string, unknown>, keyPair: crypto.KeyPairKeyObjectResult): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), keyPair.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const certs = { 'test-key': publicKeyPem };

function chatToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signChatToken(
    {
      iss: CHAT_TOKEN_ISSUER,
      aud: AUDIENCE,
      sub: '1234567890',
      email: 'user@example.org',
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    keyPair
  );
}

test('the default issuer allowlist rejects a Google Chat identity token', async () => {
  const defaultClient = new OAuth2Client();
  await assert.rejects(
    () => defaultClient.verifySignedJwtWithCertsAsync(chatToken(), certs, AUDIENCE, defaultClient.issuers),
    /Invalid issuer/
  );
});

test('a verifier configured for the Chat issuer accepts the token', async () => {
  const chatClient = new OAuth2Client({ issuers: [CHAT_TOKEN_ISSUER] });
  const ticket = await chatClient.verifySignedJwtWithCertsAsync(
    chatToken(),
    certs,
    AUDIENCE,
    chatClient.issuers
  );
  const payload = ticket.getPayload();
  assert.equal(payload?.iss, CHAT_TOKEN_ISSUER);
  assert.equal(payload?.aud, AUDIENCE);
});

test('the Chat verifier still rejects a token for a different audience', async () => {
  const chatClient = new OAuth2Client({ issuers: [CHAT_TOKEN_ISSUER] });
  await assert.rejects(
    () => chatClient.verifySignedJwtWithCertsAsync(chatToken(), certs, 'some-other-audience', chatClient.issuers),
    /Wrong recipient/
  );
});

test('the Chat verifier still rejects a token from another issuer', async () => {
  const chatClient = new OAuth2Client({ issuers: [CHAT_TOKEN_ISSUER] });
  await assert.rejects(
    () =>
      chatClient.verifySignedJwtWithCertsAsync(
        chatToken({ iss: 'https://accounts.google.com' }),
        certs,
        AUDIENCE,
        chatClient.issuers
      ),
    /Invalid issuer/
  );
});
