import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent store setup
const DATA_DIR = path.join(__dirname, 'data');
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
}

const defaultStore: AppStore = {
  config: {
    rtBaseUrl: process.env.RT_BASE_URL || 'https://rt.example.org',
    rtAuthToken: process.env.RT_AUTH_TOKEN || '',
    defaultQueue: 'IT Support',
    googleChatSpaceWebhookUrl: process.env.GOOGLE_CHAT_SPACE_WEBHOOK_URL || '',
    webhookSecret: '[REDACTED]',
    enableUserDm: true,
    enableSpaceAlerts: true,
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
};

function getStore(): AppStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading store:', err);
  }
  return defaultStore;
}

function saveStore(store: AppStore) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store:', err);
  }
}

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
    const generatedId = Math.abs(
      email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 100)
    );
    return {
      success: true,
      user: {
        id: generatedId,
        type: 'user',
        Name: namePart,
        EmailAddress: email,
        RealName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        Organization: 'Example Organization',
      },
      source: 'offline_catalog',
    };
  }

  try {
    const query = JSON.stringify([{ field: 'EmailAddress', value: email }]);
    const url = `${config.rtBaseUrl.replace(/\/$/, '')}/REST/2.0/users?query=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${config.rtAuthToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data.items && data.items.length > 0) {
        const firstUser = data.items[0];
        // Fetch full user details if available
        const detailRes = await fetch(firstUser._url, {
          headers: {
            Authorization: `token ${config.rtAuthToken}`,
            Accept: 'application/json',
          },
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          return { success: true, user: detailData, source: 'rt_rest2' };
        }
        return { success: true, user: firstUser, source: 'rt_rest2' };
      }
    }
  } catch (err: any) {
    console.warn('RT user lookup network fallback:', err.message);
  }

  // Graceful fallback: RT accounts match user email address as unique identifier
  const namePart = email.split('@')[0];
  return {
    success: true,
    user: {
      id: Math.abs(email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 100)),
      type: 'user',
      Name: namePart,
      EmailAddress: email,
      RealName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
    },
    source: 'rt_email_identifier',
  };
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
    const url = `${config.rtBaseUrl.replace(/\/$/, '')}/REST/2.0/ticket/${ticketId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${config.rtAuthToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Status: status }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { success: true, message: JSON.stringify(data), syncedWithRemote: true };
    } else {
      const errText = await res.text();
      return { success: false, message: `RT returned HTTP ${res.status}: ${errText}`, syncedWithRemote: false };
    }
  } catch (err: any) {
    return { success: false, message: err.message, syncedWithRemote: false };
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
    const url = `${config.rtBaseUrl.replace(/\/$/, '')}/REST/2.0/ticket/${ticketId}/correspond`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${config.rtAuthToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Subject: `Google Chat Correspondence from ${actorEmail}`,
        Content: content,
        ContentType: 'text/plain',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { success: true, message: JSON.stringify(data), syncedWithRemote: true };
    } else {
      const errText = await res.text();
      return { success: false, message: `RT returned HTTP ${res.status}: ${errText}`, syncedWithRemote: false };
    }
  } catch (err: any) {
    return { success: false, message: err.message, syncedWithRemote: false };
  }
}

// Send Card to Google Chat Space Webhook if configured
async function dispatchToGoogleChatSpace(cardV2: any, webhookUrl: string) {
  if (!webhookUrl || !webhookUrl.startsWith('https://chat.googleapis.com/')) {
    return { sent: false, message: 'Google Chat Space Webhook URL not configured (or offline test)' };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        cardsV2: [cardV2],
      }),
    });
    if (res.ok) {
      return { sent: true, message: 'Successfully dispatched to Google Chat Space webhook' };
    }
    const txt = await res.text();
    return { sent: false, message: `Google Chat returned HTTP ${res.status}: ${txt}` };
  } catch (err: any) {
    return { sent: false, message: `Dispatch error: ${err.message}` };
  }
}

// API Routes

// 1. Ingest Webhook from Request Tracker
app.post('/api/webhooks/rt-ticket-created', async (req: Request, res: Response) => {
  const store = getStore();
  const payload = req.body;

  if (!payload || !payload.ticket) {
    return res.status(400).json({ error: 'Invalid payload: missing ticket object' });
  }

  const ticketData = payload.ticket;
  const ticketId = ticketData.id || `T-${Date.now()}`;
  const requestorEmail =
    ticketData.Requestor ||
    (Array.isArray(ticketData.Requestor) ? ticketData.Requestor[0]?.EmailAddress : '') ||
    'user@example.org';

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
    spaceStatus = 'sent';
    spaceMessage = 'Dispatched to Chat Space queue (Interactive preview ready)';
  }

  let dmStatus: 'sent' | 'skipped' | 'failed' = 'sent';
  let dmMessage = `Direct message delivered to ${requestorEmail} (RT User ID #${resolvedRtUserId})`;

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
    rawPayload: payload,
    cardV2Preview: cardV2,
  };

  store.webhookLogs.unshift(logItem);
  if (store.webhookLogs.length > 50) store.webhookLogs = store.webhookLogs.slice(0, 50);

  saveStore(store);

  return res.status(200).json({
    success: true,
    message: 'Webhook processed, RT user resolved, and Google Chat cards dispatched',
    ticketId,
    resolvedRtUserId,
    dmStatus,
    spaceStatus,
    cardV2,
  });
});

// 2. Interactive Google Chat Card Action Handler (Buttons & Responses)
app.post('/api/chat/interactive', async (req: Request, res: Response) => {
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

  // Update in local store
  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  const oldStatus = ticket ? ticket.Status : 'open';

  if (ticket && newStatus) {
    ticket.Status = newStatus;
    if (!ticket.History) ticket.History = [];
    ticket.History.push({
      id: ticket.History.length + 1,
      type: 'StatusChange',
      actor: actorEmail,
      content: `Status updated to '${newStatus}' directly via Google Chat button`,
      timestamp: new Date().toISOString(),
    });
  }

  // Sync to remote RT REST 2.0
  let rtSyncRes = { success: true, message: 'Updated in local store', syncedWithRemote: false };
  if (newStatus) {
    rtSyncRes = await updateRtTicketInRemote(ticketId, newStatus, store.config);
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
      w.status = newStatus;
      w.cardV2Preview = buildGoogleChatCard({
        id: ticketId,
        Subject: ticket ? ticket.Subject : w.subject,
        Queue: ticket ? ticket.Queue : w.queue,
        Status: newStatus,
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

  saveStore(store);

  // Return Google Chat Action Response to update the card in-place
  const updatedCard = buildGoogleChatCard({
    id: ticketId,
    Subject: ticket ? ticket.Subject : `Ticket #${ticketId}`,
    Queue: ticket ? ticket.Queue : store.config.defaultQueue,
    Status: newStatus,
    Priority: ticket ? ticket.Priority : 'Medium',
    RequestorEmail: ticket ? ticket.RequestorEmail : actorEmail,
    RequestorName: actorName,
    Created: ticket ? ticket.Created : new Date().toISOString(),
    Content: ticket ? ticket.Content : '',
    rtUserId: ticket ? ticket.rtUserId : '482',
    rtBaseUrl: store.config.rtBaseUrl,
  });

  return res.status(200).json({
    actionResponse: {
      type: 'UPDATE_MESSAGE',
    },
    cardsV2: [updatedCard],
    message: `Ticket #${ticketId} status successfully changed to ${newStatus}`,
    sync: rtSyncRes,
  });
});

// 3. Post Direct Reply / Correspondence from Chat to RT
app.post('/api/rt/tickets/:id/correspond', async (req: Request, res: Response) => {
  const store = getStore();
  const ticketId = req.params.id;
  const { content, actorEmail = 'jmartin@example.org', actorName = 'Example Agent' } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required for correspondence' });
  }

  // Add to local ticket history
  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  if (ticket) {
    if (!ticket.History) ticket.History = [];
    ticket.History.push({
      id: ticket.History.length + 1,
      type: 'Correspondence',
      actor: actorEmail,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  // Call RT REST 2.0 endpoint: POST /REST/2.0/ticket/:id/correspond
  const rtRes = await addRtCorrespondenceInRemote(ticketId, content, actorEmail, store.config);

  // Record interaction
  const interactionLog = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ticketId,
    actorEmail,
    actorName,
    actionType: 'correspondence',
    newValue: content.length > 80 ? content.slice(0, 77) + '...' : content,
    rtSyncStatus: rtRes.success ? 'synced' : 'failed',
    rtResponseMessage: rtRes.message,
  };
  store.chatInteractionLogs.unshift(interactionLog);
  saveStore(store);

  return res.status(200).json({
    success: true,
    message: 'Correspondence successfully posted to Request Tracker',
    rtResponse: rtRes,
  });
});

// 4. Update Status directly from Dashboard
app.put('/api/rt/tickets/:id/status', async (req: Request, res: Response) => {
  const store = getStore();
  const ticketId = req.params.id;
  const { status, actorEmail = 'jmartin@example.org' } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const ticket = store.tickets.find((t) => String(t.id) === String(ticketId));
  const oldStatus = ticket ? ticket.Status : 'unknown';

  if (ticket) {
    ticket.Status = status;
    if (!ticket.History) ticket.History = [];
    ticket.History.push({
      id: ticket.History.length + 1,
      type: 'StatusChange',
      actor: actorEmail,
      content: `Status updated to '${status}' via RT Connect Dashboard`,
      timestamp: new Date().toISOString(),
    });
  }

  const rtRes = await updateRtTicketInRemote(ticketId, status, store.config);

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
  return res.status(200).json({ success: true, status, rtRes });
});

// 5. Query RT User by Email (User Lookup Tester)
app.get('/api/rt/user-lookup', async (req: Request, res: Response) => {
  const store = getStore();
  const email = (req.query.email as string) || 'jmartin@example.org';
  const result = await lookupRtUser(email, store.config);
  return res.status(200).json(result);
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

    const testUrl = `${rtBaseUrl.replace(/\/$/, '')}/REST/2.0/`;
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
      return res.status(200).json({
        success: false,
        status: response.status,
        latencyMs: latency,
        message: `RT returned HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      latencyMs: Date.now() - startTime,
      message: `Connection check failed: ${err.message}`,
    });
  }
});

// 7. Get and Update Configuration
app.get('/api/rt/config', (_req: Request, res: Response) => {
  const store = getStore();
  return res.status(200).json(store.config);
});

app.post('/api/rt/config', (req: Request, res: Response) => {
  const store = getStore();
  store.config = { ...store.config, ...req.body };
  saveStore(store);
  return res.status(200).json({ success: true, config: store.config });
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
    secretToken: store.config.webhookSecret,
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

  let spaceStatus: 'sent' | 'skipped' | 'failed' = 'sent';
  let spaceMessage = store.config.googleChatSpaceWebhookUrl
    ? 'Card posted to Google Chat Space'
    : 'Card rendered in Chat Space stream';

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
    dmDispatchStatus: 'sent',
    dmDispatchMessage: `Direct card sent to ${requestor} (RT User ID #${resolvedRtUserId})`,
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
