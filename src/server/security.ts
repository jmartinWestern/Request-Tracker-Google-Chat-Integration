import crypto from 'node:crypto';

export function verifyRtSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  maxAgeSeconds = 300,
  now = Date.now(),
}: {
  rawBody: string;
  timestamp?: string;
  signature?: string;
  secret: string;
  maxAgeSeconds?: number;
  now?: number;
}) {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > maxAgeSeconds * 1000) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const provided = String(signature).replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

export function validateTicketPayload(payload: any) {
  if (!payload || typeof payload !== 'object' || !payload.ticket || typeof payload.ticket !== 'object') {
    throw new Error('Invalid payload: missing ticket object');
  }
  const ticket = payload.ticket;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(ticket.id || ''))) throw new Error('Invalid ticket id');
  if (typeof ticket.Subject !== 'string' || ticket.Subject.trim().length === 0 || ticket.Subject.length > 500) {
    throw new Error('Invalid ticket subject');
  }
  if (ticket.Status !== undefined) validateStatus(ticket.Status);
  const requestor = Array.isArray(ticket.Requestor) ? ticket.Requestor[0]?.EmailAddress : ticket.Requestor;
  if (typeof requestor !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestor)) throw new Error('Invalid requestor email');
  if (ticket.Content !== undefined && (typeof ticket.Content !== 'string' || ticket.Content.length > 100_000)) {
    throw new Error('Invalid ticket content');
  }
}

export function validateStatus(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) throw new Error('Invalid ticket status');
  return value;
}

export function validateText(value: unknown, field: string, maxLength = 20_000) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${field} must be non-empty text no longer than ${maxLength} characters`);
  }
  return value.trim();
}

export function redactPayload(value: any): any {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/token|secret|authorization|password/i.test(key)) return [key, '[REDACTED]'];
    return [key, redactPayload(item)];
  }));
}

export function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function withRetry<T>(operation: (attempt: number, signal: AbortSignal) => Promise<T>, options: {
  maxRetries?: number;
  timeoutMs?: number;
} = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 8000;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await operation(attempt, controller.signal);
    } catch (error: any) {
      if (attempt >= maxRetries || (error?.status && !isTransientStatus(error.status))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
}
