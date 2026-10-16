import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import {
  redactPayload,
  validateStatus,
  validateText,
  validateTicketPayload,
  verifyRtSignature,
  withRetry,
} from './src/server/security';

dotenv.config();

function loadSecret(name: string) {
  const filePath = process.env[`${name}_FILE`];
  if (!filePath) return process.env[name] || '';
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    throw new Error(`Unable to read required secret file for ${name}`);
  }
}

function envBoolean(name: string, fallback: boolean) {
  const value = process.env[name];
  return value === undefined ? fallback : value.toLowerCase() === 'true';
}

for (const secretName of ['RT_AUTH_TOKEN', 'RT_WEBHOOK_SECRET', 'GOOGLE_CHAT_SPACE_WEBHOOK_URL', 'RT_CONNECT_ADMIN_TOKEN']) {
  if (process.env[`${secretName}_FILE`]) process.env[secretName] = loadSecret(secretName);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 128 * 1024);

function cryptoHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

app.use(express.json({
  limit: MAX_BODY_BYTES,
  verify: (req, _res, buffer) => {
    (req as Request & { rawBody?: string }).rawBody = buffer.toString('utf8');
  },
}));

// Persistent store setup
const DATA_DIR = process.env.RT_CONNECT_DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface AppStore {
  config: {
    rtBaseUrl: string;
    rtAuthToken: string;
    defaultQueue: string;
    googleChatSpaceWebhookUrl: string;
    webhookSecret: string;
    enableUserDm: boolean;
    enableSpaceAlerts: boolean;
  };
  webhookLogs: any[];
  chatInteractionLogs: any[];
  tickets: any[];
  eventReceipts: Record<string, { status: string; response?: unknown; updatedAt: string }>;
  operationReceipts: Record<string, { status: string; updatedAt: string }>;
}

const defaultStore: AppStore = {
  config: {
    rtBaseUrl: process.env.RT_BASE_URL || 'https://rt.example.org',
    rtAuthToken: process.env.RT_AUTH_TOKEN || '',
    defaultQueue: 'IT Support',
    googleChatSpaceWebhookUrl: process.env.GOOGLE_CHAT_SPACE_WEBHOOK_URL || '',
    webhookSecret: process.env.RT_WEBHOOK_SECRET || '',
    enableUserDm: envBoolean('RT_ENABLE_USER_DM', false),
    enableSpaceAlerts: envBoolean('RT_ENABLE_SPACE_ALERTS', true),
  },
  webhookLogs: [
    {
      id: 'wh-seed-10482',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      event: 'ticket_created',
      ticketId: '10482',
      subject: 'Network switch port flap in Media Center Lab',
      queue: 'IT Support',
      status: 'open',
      priority: 'High',
      requestorEmail: 'jmartin@example.org',
      resolvedRtUserId: '482',
      resolvedRtUserName: 'jmartin',
      dmDispatchStatus: 'sent',
      dmDispatchMessage: 'Direct card sent to jmartin@example.org',
      spaceDispatchStatus: 'sent',
      spaceDispatchMessage: 'Card posted to #it-support-alerts space',
      rawPayload: {
        event: 'ticket_created',
        ticket: {
          id: 10482,
          Subject: 'Network switch port flap in Media Center Lab',
          Queue: 'IT Support',
          Status: 'open',
          Priority: 'High',
          Requestor: 'jmartin@example.org',
          RequestorName: 'Example Agent',
          Created: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          Content: 'Port 14 on switch SW-MC-02 is reporting intermittent link renegotiation errors affecting 8 student workstations.',
          Url: 'https://rt.example.org/Ticket/Display.html?id=10482',
        },
      },
      cardV2Preview: buildGoogleChatCard({
        id: '10482',
        Subject: 'Network switch port flap in Media Center Lab',
        Queue: 'IT Support',
        Status: 'open',
        Priority: 'High',
        RequestorEmail: 'jmartin@example.org',
        RequestorName: 'Example Agent',
        Created: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        Content: 'Port 14 on switch SW-MC-02 is reporting intermittent link renegotiation errors affecting 8 student workstations.',
        rtUserId: '482',
      }),
    },
    {
      id: 'wh-seed-10481',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      event: 'ticket_created',
      ticketId: '10481',
      subject: 'New teacher onboarding: Google Classroom & RT account setup',
      queue: 'Accounts',
      status: 'resolved',
      priority: 'Medium',
      requestorEmail: 'sarah.connor@example.org',
      resolvedRtUserId: '399',
      resolvedRtUserName: 'sconnor',
      dmDispatchStatus: 'sent',
      dmDispatchMessage: 'Direct card sent to sarah.connor@example.org',
      spaceDispatchStatus: 'sent',
      spaceDispatchMessage: 'Card posted to #it-support-alerts space',
      rawPayload: {
        event: 'ticket_created',
        ticket: {
          id: 10481,
          Subject: 'New teacher onboarding: Google Classroom & RT account setup',
          Queue: 'Accounts',
          Status: 'resolved',
          Priority: 'Medium',
          Requestor: 'sarah.connor@example.org',
          RequestorName: 'Example Requestor',
          Created: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          Content: 'Please provision email, Google Workspace Chat, and RT access for our new STEM teacher starting Monday.',
          Url: 'https://rt.example.org/Ticket/Display.html?id=10481',
        },
      },
      cardV2Preview: buildGoogleChatCard({
        id: '10481',
        Subject: 'New teacher onboarding: Google Classroom & RT account setup',
        Queue: 'Accounts',
        Status: 'resolved',
        Priority: 'Medium',
        RequestorEmail: 'sarah.connor@example.org',
        RequestorName: 'Example Requestor',
        Created: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        Content: 'Please provision email, Google Workspace Chat, and RT access for our new STEM teacher starting Monday.',
        rtUserId: '399',
      }),
    },
  ],
  chatInteractionLogs: [
    {
      id: 'act-seed-1',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      ticketId: '10481',
      actorEmail: 'jmartin@example.org',
      actorName: 'Example Agent',
      actionType: 'status_change',
      previousValue: 'open',
      newValue: 'resolved',
      rtSyncStatus: 'synced',
      rtResponseMessage: "Status changed from 'open' to 'resolved' via RT REST 2.0 PUT /ticket/10481",
    },
  ],
  tickets: [
    {
      id: 10482,
      Subject: 'Network switch port flap in Media Center Lab',
      Status: 'open',
      Queue: 'IT Support',
      Priority: 'High',
      RequestorEmail: 'jmartin@example.org',
      RequestorName: 'Example Agent',
      Owner: { id: 482, Name: 'jmartin' },
      Created: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      Content: 'Port 14 on switch SW-MC-02 is reporting intermittent link renegotiation errors affecting 8 student workstations.',
      History: [
        {
          id: 1,
          type: 'Create',
          actor: 'jmartin@example.org',
          content: 'Ticket created via RT Webhook scrip',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: 10481,
      Subject: 'New teacher onboarding: Google Classroom & RT account setup',
      Status: 'resolved',
      Queue: 'Accounts',
      Priority: 'Medium',
      RequestorEmail: 'sarah.connor@example.org',
      RequestorName: 'Example Requestor',
      Owner: { id: 482, Name: 'jmartin' },
      Created: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      Content: 'Please provision email, Google Workspace Chat, and RT access for our new STEM teacher starting Monday.',
      History: [
        {
          id: 1,
          type: 'Create',
          actor: 'sarah.connor@example.org',
          content: 'Ticket created via RT Webhook scrip',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          type: 'StatusChange',
          actor: 'jmartin@example.org',
          content: "Status changed to 'resolved' via Google Chat Action Card",
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
      ],
    },
  ],
  eventReceipts: {},
  operationReceipts: {},
};

function getStore(): AppStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      const stored = JSON.parse(data);
      return {
        ...defaultStore,
        ...stored,
        config: {
          ...defaultStore.config,
          ...stored.config,
          rtAuthToken: process.env.RT_AUTH_TOKEN || stored.config.rtAuthToken || defaultStore.config.rtAuthToken,
          webhookSecret: process.env.RT_WEBHOOK_SECRET || stored.config.webhookSecret || defaultStore.config.webhookSecret,
          enableUserDm: envBoolean('RT_ENABLE_USER_DM', stored.config.enableUserDm ?? defaultStore.config.enableUserDm),
          enableSpaceAlerts: envBoolean('RT_ENABLE_SPACE_ALERTS', stored.config.enableSpaceAlerts ?? defaultStore.config.enableSpaceAlerts),
        },
        eventReceipts: stored.eventReceipts || {},
        operationReceipts: stored.operationReceipts || {},
      };
    }
  } catch (err) {
    console.error('Error reading store:', err);
  }
  return defaultStore;
}

function saveStore(store: AppStore) {
  try {
    const temporaryPath = `${STORE_PATH}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(temporaryPath, STORE_PATH);
  } catch (err) {
    console.error('Error writing store:', err);
  }
}

function getSafeConfig(config: AppStore['config']) {
  return {
    ...config,
    rtAuthToken: config.rtAuthToken ? '[configured]' : '',
    webhookSecret: config.webhookSecret ? '[configured]' : '',
    googleChatSpaceWebhookUrl: config.googleChatSpaceWebhookUrl ? '[configured]' : '',
  };
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (req.path === '/webhooks/rt-ticket-created' || req.path === '/chat/interactive') return next();
  if (process.env.NODE_ENV !== 'production') return next();
  const expected = process.env.RT_CONNECT_ADMIN_TOKEN;
  if (!expected) return res.status(503).json({ error: 'Admin authentication is not configured' });
  const provided = req.header('x-rt-connect-admin-token');
  if (!provided || provided !== expected) return res.status(401).json({ error: 'Admin authentication required' });
  next();
}

const chatTokenVerifier = new OAuth2Client();
async function requireChatIdentity(req: Request, res: Response, next: () => void) {
  const adminToken = req.header('x-rt-connect-admin-token');
  if (process.env.NODE_ENV === 'production' && process.env.RT_CONNECT_ADMIN_TOKEN && adminToken === process.env.RT_CONNECT_ADMIN_TOKEN) return next();
  if (process.env.NODE_ENV !== 'production' && !req.header('authorization')) return next();
  if (process.env.NODE_ENV === 'production' && !process.env.CHAT_AUDIENCE) {
    return res.status(503).json({ error: 'CHAT_AUDIENCE is not configured' });
  }
  const authorization = req.header('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Google Chat identity required' });
  try {
    const ticket = await chatTokenVerifier.verifyIdToken({
      idToken: authorization.slice('Bearer '.length),
      audience: process.env.CHAT_AUDIENCE || undefined,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.iss !== 'chat@system.gserviceaccount.com') throw new Error('Invalid Google Chat token issuer');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid Google Chat identity' });
  }
}

app.use('/api', requireAdmin);

// Helper: Build Google Chat Card v2 schema
function buildGoogleChatCard(ticket: {
  id: string | number;
  Subject: string;
  Queue: string;
  Status: string;
  Priority: string | number;
  RequestorEmail: string;
  RequestorName?: string;
  Created?: string;
  Content?: string;
  rtUserId?: string | number;
  rtBaseUrl?: string;
}) {
  const baseUrl = ticket.rtBaseUrl || 'https://rt.example.org';
  const displayUrl = `${baseUrl}/Ticket/Display.html?id=${ticket.id}`;
  const statusColor =
    ticket.Status === 'resolved'
      ? '🟢 Resolved'
      : ticket.Status === 'open'
      ? '🔵 Open'
      : ticket.Status === 'stalled'
      ? '🟠 Stalled'
      : '⚪ ' + ticket.Status.toUpperCase();

  return {
    cardId: `rt_ticket_${ticket.id}`,
    card: {
      header: {
        title: `RT #${ticket.id}: ${ticket.Subject}`,
        subtitle: `Queue: ${ticket.Queue} · ${statusColor} · Priority: ${ticket.Priority}`,
        imageType: 'SQUARE',
      },
      sections: [
        {
          header: 'Ticket Details',
          collapsible: false,
          widgets: [
            {
              decoratedText: {
                topLabel: 'Requestor (Unique RT Identifier)',
                text: `${ticket.RequestorEmail} ${ticket.RequestorName ? `(${ticket.RequestorName})` : ''}`,
                bottomLabel: ticket.rtUserId ? `RT User ID: #${ticket.rtUserId}` : 'Resolving RT User ID...',
              },
            },
            {
              decoratedText: {
                topLabel: 'Created Timestamp',
                text: ticket.Created || new Date().toISOString(),
              },
            },
            {
              textParagraph: {
                text: ticket.Content || '(No initial description provided)',
              },
            },
          ],
        },
        {
          header: 'Quick Status Actions',
          collapsible: false,
          widgets: [
            {
              buttonList: {
                buttons: [
                  {
                    text: 'Open',
                    onClick: {
                      action: {
                        function: 'update_ticket_status',
                        parameters: [
                          { key: 'ticketId', value: String(ticket.id) },
                          { key: 'status', value: 'open' },
                        ],
                      },
                    },
                  },
                  {
                    text: 'Resolve',
                    onClick: {
                      action: {
                        function: 'update_ticket_status',
                        parameters: [
                          { key: 'ticketId', value: String(ticket.id) },
                          { key: 'status', value: 'resolved' },
                        ],
                      },
                    },
                  },
                  {
                    text: 'Stall',
                    onClick: {
                      action: {
                        function: 'update_ticket_status',
                        parameters: [
                          { key: 'ticketId', value: String(ticket.id) },
                          { key: 'status', value: 'stalled' },
                        ],
                      },
                    },
                  },
                  {
                    text: 'View in RT ↗',
                    onClick: {
                      openLink: {
                        url: displayUrl,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          header: 'Respond directly to Ticket',
          collapsible: true,
          widgets: [
            {
              textParagraph: {
                text: '💡 Reply in this chat thread or use the correspondence composer below to post updates directly to RT.',
              },
            },
          ],
        },
      ],
    },
  };
}

// RT REST 2.0 User Lookup function
async function lookupRtUser(email: string, config: AppStore['config']) {
  if (!config.rtAuthToken || !config.rtBaseUrl.startsWith('http')) {
    // Return standard mock lookup based on RT specification
    const namePart = email.split('@')[0];
    return {
      success: true,
      user: {
        type: 'user',
        Name: namePart,
        EmailAddress: email,
        RealName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        Organization: 'Example Organization',
      },
      source: 'offline_catalog',
      message: undefined,
    };
  }

  try {
    const query = JSON.stringify([{ field: 'EmailAddress', operator: '=', value: email }]);
    const url = `${config.rtBaseUrl.replace(/\/$/, '')}/REST/2.0/users?query=${encodeURIComponent(query)}`;
    return await withRetry(async (_attempt, signal) => {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `token ${config.rtAuthToken}`, Accept: 'application/json' },
        signal,
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error: any = new Error(data.message || `RT user search returned HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      if (!Array.isArray(data.items) || data.items.length === 0) {
        return { success: false, user: null, source: 'rt_rest2', message: 'RT user not found' };
      }
      const firstUser = data.items[0];
      if (!firstUser._url) return { success: true, user: firstUser, source: 'rt_rest2', message: undefined };
      const detailRes = await fetch(firstUser._url, {
        headers: { Authorization: `token ${config.rtAuthToken}`, Accept: 'application/json' },
        signal,
      });
      const detailData: any = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok && (detailRes.status === 401 || detailRes.status === 403)) {
        const error: any = new Error(detailData.message || `RT user detail returned HTTP ${detailRes.status}`);
        error.status = detailRes.status;
        throw error;
      }
      return { success: true, user: detailRes.ok ? detailData : firstUser, source: 'rt_rest2', message: undefined };
    }, { timeoutMs: 8000, maxRetries: 2 });
  } catch (err: any) {
    console.warn('RT user lookup failed:', err.message);
    return { success: false, user: null, source: 'rt_rest2', message: err.message, status: err.status };
  }
}

async function getRtTicketState(ticketId: string | number, config: AppStore['config']) {
  const url = `${config.rtBaseUrl.replace(/\/$/, '')}/REST/2.0/ticket/${encodeURIComponent(String(ticketId))}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OUTBOUND_TIMEOUT_MS || 8000));
  try {
    const response = await fetch(url, {
      headers: { Authorization: `token ${config.rtAuthToken}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error: any = new Error(data.message || `RT ticket lookup returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return { data, etag: response.headers.get('etag') || undefined, url };
  } finally {
    clearTimeout(timeout);
  }
}

function getLifecycleLink(ticket: any, status: string) {
  return Array.isArray(ticket?._hyperlinks)
    ? ticket._hyperlinks.find((link: any) => link.ref === 'lifecycle' && String(link.to) === status)
    : undefined;
}

function getHyperlink(ticket: any, ref: string) {
  return Array.isArray(ticket?._hyperlinks)
    ? ticket._hyperlinks.find((link: any) => link.ref === ref)
    : undefined;
}

function formatRtError(error: any) {
  return { success: false, message: error.message, status: error.status, syncedWithRemote: false };
}

// RT REST 2.0 Ticket Status Update
async function updateRtTicketInRemote(ticketId: string | number, status: string, config: AppStore['config']) {
  if (!config.rtAuthToken || !config.rtBaseUrl.startsWith('http')) {
    return {
      success: true,
      message: `Status updated to '${status}' in RT mock store`,
      syncedWithRemote: false,
    };
  }

  try {
    const current = await getRtTicketState(ticketId, config);
    const lifecycle = getLifecycleLink(current.data, status);
    if (!lifecycle) {
      if (current.data?.Status === status) return { success: true, message: 'RT ticket already has requested status', syncedWithRemote: true };
      const error: any = new Error(`RT does not expose permitted lifecycle transition to '${status}'`);
      error.status = 409;
      return formatRtError(error);
    }
    const response = await fetch(lifecycle._url || current.url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${config.rtAuthToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(current.etag ? { 'If-Match': current.etag } : {}),
      },
      body: JSON.stringify({ Status: status }),
      signal: AbortSignal.timeout(Number(process.env.OUTBOUND_TIMEOUT_MS || 8000)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 412) {
        const reconciled = await getRtTicketState(ticketId, config).catch(() => null);
        if (reconciled?.data?.Status === status) return { success: true, message: 'RT status already applied after concurrent update', syncedWithRemote: true };
      }
      const error: any = new Error(data.message || `RT returned HTTP ${response.status}`);
      error.status = response.status;
      return formatRtError(error);
    }
    return { success: true, message: JSON.stringify(data), syncedWithRemote: true };
  } catch (err: any) {
    return formatRtError(err);
  }
}

// RT REST 2.0 Ticket Correspondence
async function addRtCorrespondenceInRemote(
  ticketId: string | number,
  content: string,
  actorEmail: string,
  config: AppStore['config']
) {
  if (!config.rtAuthToken || !config.rtBaseUrl.startsWith('http')) {
    return {
      success: true,
      message: `Correspondence posted to RT mock store`,
      syncedWithRemote: false,
    };
  }

  try {
    const current = await getRtTicketState(ticketId, config);
    const correspond = getHyperlink(current.data, 'correspond');
    if (!correspond?._url) {
      const error: any = new Error('RT does not expose correspondence permission for this ticket');
      error.status = 403;
      return formatRtError(error);
    }
    const response = await fetch(correspond._url, {
      method: 'POST',
      headers: {
        Authorization: `token ${config.rtAuthToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Subject: `Google Chat Correspondence from ${actorEmail}`, Content: content, ContentType: 'text/plain' }),
      signal: AbortSignal.timeout(Number(process.env.OUTBOUND_TIMEOUT_MS || 8000)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error: any = new Error(data.message || `RT returned HTTP ${response.status}`);
      error.status = response.status;
      return formatRtError(error);
    }
    return { success: true, message: JSON.stringify(data), syncedWithRemote: true };
  } catch (err: any) {
    return formatRtError(err);
  }
}

// Send Card to Google Chat Space Webhook if configured
async function dispatchToGoogleChatSpace(cardV2: any, webhookUrl: string) {
  const apiSpace = process.env.GOOGLE_CHAT_SPACE_NAME;
  if (!webhookUrl && !apiSpace) return { sent: false, message: 'Google Chat delivery is not configured' };
  try {
    return await withRetry(async (_attempt, signal) => {
      let targetUrl = webhookUrl;
      let headers: Record<string, string> = { 'Content-Type': 'application/json; charset=UTF-8' };
      if (!targetUrl && apiSpace) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/chat.bot'] });
        const client = await auth.getClient();
        headers = { ...headers, ...(await client.getRequestHeaders()) } as Record<string, string>;
        targetUrl = `https://chat.googleapis.com/v1/${apiSpace}/messages`;
      }
      if (!targetUrl?.startsWith('https://chat.googleapis.com/')) throw new Error('Invalid Google Chat delivery URL');
      const res = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify({ cardsV2: [cardV2] }), signal });
      if (!res.ok) {
        const error: any = new Error(`Google Chat returned HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return { sent: true, message: apiSpace && !webhookUrl ? 'Successfully dispatched through Google Chat API' : 'Successfully dispatched to Google Chat Space webhook' };
    }, { timeoutMs: Number(process.env.OUTBOUND_TIMEOUT_MS || 8000), maxRetries: Number(process.env.MAX_RETRIES || 2) });
  } catch (err: any) {
    return { sent: false, message: `Dispatch error: ${err.message}` };
  }
}

// API Routes

// 1. Ingest Webhook from Request Tracker
app.post('/api/webhooks/rt-ticket-created', async (req: Request, res: Response) => {
  const store = getStore();
  const payload = req.body;
  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(payload);
  const signature = req.header('x-rt-signature');
  const timestamp = req.header('x-rt-timestamp');
  const signatureValid = verifyRtSignature({
    rawBody,
    timestamp,
    signature,
    secret: store.config.webhookSecret,
    maxAgeSeconds: Number(process.env.SIGNATURE_MAX_AGE_SECONDS || 300),
  });

  if (!signatureValid && !(process.env.NODE_ENV !== 'production' && payload?.secretToken && payload.secretToken === store.config.webhookSecret)) {
    return res.status(401).json({ error: 'Invalid or missing RT webhook signature' });
  }
  try {
    validateTicketPayload(payload);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  const eventId = String(req.header('x-rt-event-id') || payload.eventId || cryptoHash(rawBody));
  const existingReceipt = store.eventReceipts[eventId];
  if (existingReceipt) return res.status(200).json({ ...(existingReceipt.response as object || {}), duplicate: true });
  store.eventReceipts[eventId] = { status: 'processing', updatedAt: new Date().toISOString() };
  saveStore(store);

  const ticketData = payload.ticket;
  const ticketId = ticketData.id;
  const requestorEmail = (Array.isArray(ticketData.Requestor)
    ? ticketData.Requestor[0]?.EmailAddress
    : ticketData.Requestor) as string;

  // Step 1: Look up RT user ID by email as instructed
  const userLookup = await lookupRtUser(requestorEmail, store.config);
  const resolvedRtUserId = userLookup.user?.id;
  const resolvedRtUserName = userLookup.user?.Name || ticketData.RequestorName;

  // Step 2: Build Google Chat Card v2
  const cardV2 = buildGoogleChatCard({
    id: ticketId,
    Subject: ticketData.Subject || 'Untitled Request Tracker Ticket',
    Queue: ticketData.Queue || store.config.defaultQueue || 'General',
    Status: ticketData.Status || 'new',
    Priority: ticketData.Priority || 'Medium',
    RequestorEmail: requestorEmail,
    RequestorName: resolvedRtUserName,
    Created: ticketData.Created || new Date().toISOString(),
    Content: ticketData.Content || '(No content provided)',
    rtUserId: resolvedRtUserId,
    rtBaseUrl: store.config.rtBaseUrl,
  });

  // Step 3: Google Chat Delivery
  let spaceStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
  let spaceMessage = 'Space alerts disabled in config';
  if (store.config.enableSpaceAlerts && store.config.googleChatSpaceWebhookUrl) {
    const spaceRes = await dispatchToGoogleChatSpace(cardV2, store.config.googleChatSpaceWebhookUrl);
    spaceStatus = spaceRes.sent ? 'sent' : 'failed';
    spaceMessage = spaceRes.message;
  } else if (store.config.enableSpaceAlerts) {
    spaceStatus = 'skipped';
    spaceMessage = 'Staff-space delivery enabled but no Google Chat destination is configured';
  }

  const dmStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
  const dmMessage = store.config.enableUserDm
    ? 'Direct messaging is not implemented; space notification only'
    : 'Direct messaging disabled by configuration';

  // Save to local tickets store
  const existingTicketIndex = store.tickets.findIndex((t) => String(t.id) === String(ticketId));
  const newTicketRecord = {
    id: ticketId,
    Subject: ticketData.Subject,
    Status: ticketData.Status || 'new',
    Queue: ticketData.Queue || store.config.defaultQueue,
    Priority: ticketData.Priority || 'Medium',
    RequestorEmail: requestorEmail,
    RequestorName: resolvedRtUserName,
    rtUserId: resolvedRtUserId,
    Created: ticketData.Created || new Date().toISOString(),
    Content: ticketData.Content,
    History: [
      {
        id: 1,
        type: 'Create',
        actor: requestorEmail,
        content: ticketData.Content || 'Ticket created in RT',
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (existingTicketIndex >= 0) {
    store.tickets[existingTicketIndex] = { ...store.tickets[existingTicketIndex], ...newTicketRecord };
  } else {
    store.tickets.unshift(newTicketRecord);
  }

  // Create log item
  const logItem = {
    id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    event: payload.event || 'ticket_created',
    ticketId,
    subject: ticketData.Subject,
    queue: ticketData.Queue || store.config.defaultQueue,
    status: ticketData.Status || 'new',
    requestorEmail,
    resolvedRtUserId,
    resolvedRtUserName,
    dmDispatchStatus: dmStatus,
    dmDispatchMessage: dmMessage,
    spaceDispatchStatus: spaceStatus,
    spaceDispatchMessage: spaceMessage,
    rawPayload: redactPayload(payload),
    cardV2Preview: cardV2,
  };

  store.webhookLogs.unshift(logItem);
  if (store.webhookLogs.length > 50) store.webhookLogs = store.webhookLogs.slice(0, 50);

  saveStore(store);
  const response = {
    success: true,
    message: 'Webhook processed, RT user resolved, and Google Chat cards dispatched',
    ticketId,
    resolvedRtUserId,
    dmStatus,
    spaceStatus,
    cardV2,
  };
  store.eventReceipts[eventId] = { status: 'completed', response, updatedAt: new Date().toISOString() };
  saveStore(store);
  return res.status(200).json(response);
});

// 2. Interactive Google Chat Card Action Handler (Buttons & Responses)
app.post('/api/chat/interactive', requireChatIdentity, async (req: Request, res: Response) => {
  const store = getStore();
  const body = req.body;

  const actionFunction =
    body.actionMethodName ||
    body.action?.function ||
    body.common?.invokedFunction ||
    'update_ticket_status';

  const parameters = body.action?.parameters || body.parameters || [];
  const paramMap: Record<string, string> = {};
  if (Array.isArray(parameters)) {
    parameters.forEach((p: any) => {
      if (p.key && p.value) paramMap[p.key] = p.value;
    });
  }

  const ticketId = paramMap.ticketId || body.ticketId;
  const newStatus = paramMap.status || body.status;
  const actorEmail = body.user?.email || body.actorEmail || 'jmartin@example.org';
  const actorName = body.user?.displayName || body.actorName || 'Example Agent';

  if (!ticketId) {
    return res.status(400).json({ error: 'Missing ticketId in interactive card action' });
  }
  try { validateStatus(newStatus); } catch (error: any) { return res.status(400).json({ error: error.message }); }
  const operationId = String(req.header('x-idempotency-key') || body.actionId || `${ticketId}:${actionFunction}:${newStatus || ''}:${actorEmail}`);
  if (store.operationReceipts[operationId]) return res.status(200).json({ success: true, duplicate: true });
  store.operationReceipts[operationId] = { status: 'processing', updatedAt: new Date().toISOString() };
  saveStore(store);

  // Update in local store
  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  const oldStatus = ticket ? ticket.Status : 'open';

  // Sync to remote RT REST 2.0
  let rtSyncRes = { success: true, message: 'Updated in local store', syncedWithRemote: false };
  if (newStatus) {
    rtSyncRes = await updateRtTicketInRemote(ticketId, newStatus, store.config);
  }

  if (ticket && newStatus && rtSyncRes.success) {
    ticket.Status = newStatus;
    if (!ticket.History) ticket.History = [];
    ticket.History.push({ id: ticket.History.length + 1, type: 'StatusChange', actor: actorEmail, content: `Status updated to '${newStatus}' directly via Google Chat button`, timestamp: new Date().toISOString() });
  }

  // Record interaction log
  const interactionLog = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ticketId,
    actorEmail,
    actorName,
    actionType: 'status_change',
    previousValue: oldStatus,
    newValue: newStatus,
    rtSyncStatus: rtSyncRes.success ? 'synced' : 'failed',
    rtResponseMessage: rtSyncRes.message,
  };
  store.chatInteractionLogs.unshift(interactionLog);
  if (store.chatInteractionLogs.length > 50) {
    store.chatInteractionLogs = store.chatInteractionLogs.slice(0, 50);
  }

  // Also update corresponding webhook card previews in log
  store.webhookLogs.forEach((w) => {
    if (String(w.ticketId) === String(ticketId)) {
      if (rtSyncRes.success) w.status = newStatus;
      w.cardV2Preview = buildGoogleChatCard({
        id: ticketId,
        Subject: ticket ? ticket.Subject : w.subject,
        Queue: ticket ? ticket.Queue : w.queue,
        Status: rtSyncRes.success ? newStatus : oldStatus,
        Priority: ticket ? ticket.Priority : 'Medium',
        RequestorEmail: ticket ? ticket.RequestorEmail : w.requestorEmail,
        RequestorName: ticket ? ticket.RequestorName : w.resolvedRtUserName,
        Created: ticket ? ticket.Created : w.timestamp,
        Content: ticket ? ticket.Content : '',
        rtUserId: w.resolvedRtUserId,
        rtBaseUrl: store.config.rtBaseUrl,
      });
    }
  });

  store.operationReceipts[operationId] = { status: rtSyncRes.success ? 'completed' : 'failed', updatedAt: new Date().toISOString() };
  saveStore(store);

  // Return Google Chat Action Response to update the card in-place
  const updatedCard = buildGoogleChatCard({
    id: ticketId,
    Subject: ticket ? ticket.Subject : `Ticket #${ticketId}`,
    Queue: ticket ? ticket.Queue : store.config.defaultQueue,
    Status: rtSyncRes.success ? newStatus : oldStatus,
    Priority: ticket ? ticket.Priority : 'Medium',
    RequestorEmail: ticket ? ticket.RequestorEmail : actorEmail,
    RequestorName: actorName,
    Created: ticket ? ticket.Created : new Date().toISOString(),
    Content: ticket ? ticket.Content : '',
    rtUserId: ticket?.rtUserId,
    rtBaseUrl: store.config.rtBaseUrl,
  });

  return res.status(rtSyncRes.success ? 200 : 502).json({
    actionResponse: {
      type: 'UPDATE_MESSAGE',
    },
    cardsV2: [updatedCard],
    message: rtSyncRes.success ? `Ticket #${ticketId} status successfully changed to ${newStatus}` : rtSyncRes.message,
    sync: rtSyncRes,
  });
});

// 3. Post Direct Reply / Correspondence from Chat to RT
app.post('/api/rt/tickets/:id/correspond', async (req: Request, res: Response) => {
  const store = getStore();
  const ticketId = req.params.id;
  const { content, actorEmail = 'jmartin@example.org', actorName = 'Example Agent' } = req.body;

  let validatedContent: string;
  try { validatedContent = validateText(content, 'Content'); } catch (error: any) { return res.status(400).json({ error: error.message }); }
  const operationId = String(req.header('x-idempotency-key') || cryptoHash(`${ticketId}:${actorEmail}:${validatedContent}`));
  if (store.operationReceipts[operationId]) return res.status(200).json({ success: true, duplicate: true });
  store.operationReceipts[operationId] = { status: 'processing', updatedAt: new Date().toISOString() };
  saveStore(store);

  // Add to local ticket history
  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  // Call RT REST 2.0 endpoint: POST /REST/2.0/ticket/:id/correspond
  const rtRes = await addRtCorrespondenceInRemote(ticketId, validatedContent, actorEmail, store.config);

  if (ticket && rtRes.success) {
    if (!ticket.History) ticket.History = [];
    ticket.History.push({ id: ticket.History.length + 1, type: 'Correspondence', actor: actorEmail, content: validatedContent, timestamp: new Date().toISOString() });
  }

  // Record interaction
  const interactionLog = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ticketId,
    actorEmail,
    actorName,
    actionType: 'correspondence',
    newValue: validatedContent.length > 80 ? validatedContent.slice(0, 77) + '...' : validatedContent,
    rtSyncStatus: rtRes.success ? 'synced' : 'failed',
    rtResponseMessage: rtRes.message,
  };
  store.chatInteractionLogs.unshift(interactionLog);
  store.operationReceipts[operationId] = { status: rtRes.success ? 'completed' : 'failed', updatedAt: new Date().toISOString() };
  saveStore(store);

  return res.status(rtRes.success ? 200 : 502).json({
    success: rtRes.success,
    message: 'Correspondence successfully posted to Request Tracker',
    rtResponse: rtRes,
  });
});

// 4. Update Status directly from Dashboard
app.put('/api/rt/tickets/:id/status', async (req: Request, res: Response) => {
  const store = getStore();
  const ticketId = req.params.id;
  const { status, actorEmail = 'jmartin@example.org' } = req.body;

  try { validateStatus(status); } catch (error: any) { return res.status(400).json({ error: error.message }); }

  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  const oldStatus = ticket ? ticket.Status : 'unknown';

  const rtRes = await updateRtTicketInRemote(ticketId, status, store.config);

  if (ticket && rtRes.success) {
    ticket.Status = status;
    if (!ticket.History) ticket.History = [];
    ticket.History.push({ id: ticket.History.length + 1, type: 'StatusChange', actor: actorEmail, content: `Status updated to '${status}' via RT Connect Dashboard`, timestamp: new Date().toISOString() });
  }

  store.chatInteractionLogs.unshift({
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ticketId,
    actorEmail,
    actorName: 'Dashboard Admin',
    actionType: 'status_change',
    previousValue: oldStatus,
    newValue: status,
    rtSyncStatus: rtRes.success ? 'synced' : 'failed',
    rtResponseMessage: rtRes.message,
  });

  saveStore(store);
  return res.status(rtRes.success ? 200 : 502).json({ success: rtRes.success, status: ticket?.Status || oldStatus, rtRes });
});

// 5. Query RT User by Email (User Lookup Tester)
app.get('/api/rt/user-lookup', async (req: Request, res: Response) => {
  const store = getStore();
  const email = (req.query.email as string) || 'jmartin@example.org';
  const result = await lookupRtUser(email, store.config);
  return res.status(result.success || result.message === 'RT user not found' ? 200 : 502).json(result);
});

// 6. Test RT REST 2.0 Connection Health Check
app.post('/api/rt/test-connection', async (req: Request, res: Response) => {
  const { rtBaseUrl, rtAuthToken } = req.body;

  if (!rtBaseUrl || !rtBaseUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid RT Base URL. Must start with http:// or https://',
    });
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const testUrl = `${rtBaseUrl.replace(/\/$/, '')}/REST/2.0/queues/all`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${rtAuthToken || ''}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - startTime;
    if (response.ok) {
      return res.status(200).json({
        success: true,
        status: response.status,
        latencyMs: latency,
        message: 'Connected to Request Tracker REST 2.0 API successfully',
      });
    } else {
      return res.status(502).json({
        success: false,
        status: response.status,
        latencyMs: latency,
        message: `RT returned HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      latencyMs: Date.now() - startTime,
      message: `Connection check failed: ${err.message}`,
    });
  }
});

// 7. Get and Update Configuration
app.get('/api/rt/config', (_req: Request, res: Response) => {
  const store = getStore();
  return res.status(200).json(getSafeConfig(store.config));
});

app.post('/api/rt/config', (req: Request, res: Response) => {
  const store = getStore();
  const allowedKeys = ['rtBaseUrl', 'rtAuthToken', 'defaultQueue', 'googleChatSpaceWebhookUrl', 'webhookSecret', 'enableUserDm', 'enableSpaceAlerts'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key, value]) => allowedKeys.includes(key) && value !== '[configured]'));
  if (updates.rtBaseUrl && (typeof updates.rtBaseUrl !== 'string' || !/^https?:\/\//.test(updates.rtBaseUrl))) return res.status(400).json({ error: 'Invalid RT base URL' });
  store.config = { ...store.config, ...updates };
  saveStore(store);
  return res.status(200).json({ success: true, config: getSafeConfig(store.config) });
});

// 8. Get Tickets and Activity
app.get('/api/rt/tickets', (_req: Request, res: Response) => {
  const store = getStore();
  return res.status(200).json(store.tickets);
});

app.get('/api/rt/tickets/:id', (req: Request, res: Response) => {
  const store = getStore();
  const ticket = store.tickets.find((t) => String(t.id) === String(req.params.id));
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  return res.status(200).json(ticket);
});

app.get('/api/activity', (_req: Request, res: Response) => {
  const store = getStore();
  return res.status(200).json({
    webhookLogs: store.webhookLogs,
    chatInteractionLogs: store.chatInteractionLogs,
  });
});

app.delete('/api/activity', (_req: Request, res: Response) => {
  const store = getStore();
  store.webhookLogs = [];
  store.chatInteractionLogs = [];
  saveStore(store);
  return res.status(200).json({ success: true, message: 'Activity logs cleared' });
});

// 9. Simulate Ingestion of a New RT Webhook (for testing & demonstration)
app.post('/api/webhooks/simulate', async (req: Request, res: Response) => {
  const store = getStore();
  const {
    subject = 'Cannot connect to District Student Information System',
    queue = 'IT Support',
    priority = 'High',
    requestor = 'jmartin@example.org',
    content = 'Users in Building C are getting timed out when submitting attendance records.',
  } = req.body;

  const simId = 10480 + Math.floor(Math.random() * 900);
  const simPayload = {
    event: 'ticket_created',
    ticket: {
      id: simId,
      Subject: subject,
      Queue: queue,
      Status: 'new',
      Priority: priority,
      Requestor: requestor,
      RequestorName: requestor.split('@')[0],
      Created: new Date().toISOString(),
      Content: content,
      Url: `${store.config.rtBaseUrl}/Ticket/Display.html?id=${simId}`,
    },
  };

  // Dispatch through internal handler
  const userLookup = await lookupRtUser(requestor, store.config);
  const resolvedRtUserId = userLookup.user?.id;
  const resolvedRtUserName = userLookup.user?.Name || requestor.split('@')[0];

  const cardV2 = buildGoogleChatCard({
    id: simId,
    Subject: subject,
    Queue: queue,
    Status: 'new',
    Priority: priority,
    RequestorEmail: requestor,
    RequestorName: resolvedRtUserName,
    Created: new Date().toISOString(),
    Content: content,
    rtUserId: resolvedRtUserId,
    rtBaseUrl: store.config.rtBaseUrl,
  });

  const newTicket = {
    id: simId,
    Subject: subject,
    Status: 'new',
    Queue: queue,
    Priority: priority,
    RequestorEmail: requestor,
    RequestorName: resolvedRtUserName,
    rtUserId: resolvedRtUserId,
    Created: new Date().toISOString(),
    Content: content,
    History: [
      {
        id: 1,
        type: 'Create',
        actor: requestor,
        content,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  store.tickets.unshift(newTicket);

  let spaceStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
  let spaceMessage = store.config.enableSpaceAlerts
    ? 'Staff-space delivery enabled but no Google Chat destination is configured'
    : 'Staff-space delivery disabled by configuration';

  if (store.config.enableSpaceAlerts && store.config.googleChatSpaceWebhookUrl) {
    const spaceRes = await dispatchToGoogleChatSpace(cardV2, store.config.googleChatSpaceWebhookUrl);
    spaceStatus = spaceRes.sent ? 'sent' : 'failed';
    spaceMessage = spaceRes.message;
  }

  const logItem = {
    id: `wh-sim-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event: 'ticket_created',
    ticketId: simId,
    subject,
    queue,
    status: 'new',
    requestorEmail: requestor,
    resolvedRtUserId,
    resolvedRtUserName,
    dmDispatchStatus: 'skipped',
    dmDispatchMessage: store.config.enableUserDm
      ? 'Direct messaging is not implemented; space notification only'
      : 'Direct messaging disabled by configuration',
    spaceDispatchStatus: spaceStatus,
    spaceDispatchMessage: spaceMessage,
    rawPayload: simPayload,
    cardV2Preview: cardV2,
  };

  store.webhookLogs.unshift(logItem);
  saveStore(store);

  return res.status(200).json({
    success: true,
    message: `Simulated ticket #${simId} created and Google Chat cards dispatched`,
    logItem,
  });
});

// Vite middleware or Static Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RT Connect server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
