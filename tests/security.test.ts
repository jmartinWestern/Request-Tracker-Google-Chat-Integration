import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { redactPayload, validateText, verifyRtSignature } from '../src/server/security';

test('accepts fresh RT HMAC signatures and rejects stale signatures', () => {
  const body = '{"ticket":{"id":1}}';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', 'secret').update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyRtSignature({ rawBody: body, timestamp, signature, secret: 'secret' }), true);
  assert.equal(verifyRtSignature({ rawBody: body, timestamp: '1', signature, secret: 'secret' }), false);
});

test('redacts credentials and validates bounded text', () => {
  assert.deepEqual(redactPayload({ token: 'hidden', nested: { password: 'hidden' } }), {
    token: '[REDACTED]',
    nested: { password: '[REDACTED]' },
  });
  assert.equal(validateText(' reply ', 'content'), 'reply');
  assert.throws(() => validateText('', 'content'));
});
