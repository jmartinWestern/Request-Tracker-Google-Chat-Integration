# API Reference

RT Connect serves dashboard APIs under `/api`. "Public" means a reverse proxy may route the path from the internet to RT Connect; it does not mean unauthenticated. "Private" means the path must not be internet-routable except through an authenticated organizational proxy.

## Exposure Matrix

| Route | Exposure | Application authentication | Sender or purpose |
| --- | --- | --- | --- |
| `POST /api/webhooks/rt-ticket-created` | Public callback | HMAC signature | Request Tracker |
| `POST /api/chat/interactive` | Public callback | Google Chat bearer identity and `CHAT_AUDIENCE` | Google Chat |
| `GET /api/rt/config` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `POST /api/rt/config` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `POST /api/rt/test-connection` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `GET /api/rt/user-lookup` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `GET /api/rt/tickets` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `GET /api/rt/tickets/:id` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `PUT /api/rt/tickets/:id/status` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `POST /api/rt/tickets/:id/correspond` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `GET /api/activity` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `DELETE /api/activity` | Private | `X-RT-Connect-Admin-Token` in production | Dashboard |
| `GET /api/diagnostics` | Private | `X-RT-Connect-Admin-Token` in production | Debug panel |
| `DELETE /api/diagnostics` | Private | `X-RT-Connect-Admin-Token` in production | Debug panel |
| `POST /api/webhooks/simulate` | Private | `X-RT-Connect-Admin-Token` in production | Testing only |

The dashboard HTML may be public or private, but its API routes remain private. The production browser build does not contain the admin token. An authenticated reverse proxy must inject `X-RT-Connect-Admin-Token` only for private dashboard/API routes. Never inject that header into `/api/chat/interactive`, because the header can bypass Google Chat identity verification.

For local development without an admin token, both `NODE_ENV=development` and `RT_ALLOW_UNAUTHENTICATED_DEV=true` are required. Compose binds this mode to localhost only.

## Public Callbacks

### `POST /api/webhooks/rt-ticket-created`

Request Tracker event ingress. Requires:

- `Content-Type: application/json`
- `X-RT-Timestamp`: Unix timestamp in seconds
- `X-RT-Signature`: `sha256=` followed by HMAC-SHA256 of `timestamp.raw_body`
- `X-RT-Event-Id`: optional deduplication key; payload `eventId` is used when absent

Payload must contain `event` and `ticket`. Ticket requires `id`, `Subject`, `Queue`, `Status`, `Priority`, and `Requestor`.

Responses:

- `200`: event processed; replay returns `duplicate: true`
- `400`: invalid ticket payload
- `401`: missing, invalid, or stale signature

Reverse proxies must forward the exact request body unchanged.

### `POST /api/chat/interactive`

Google Chat card-action callback. In production, send a Google Chat bearer identity token and configure `CHAT_AUDIENCE`. The token issuer must be `chat@system.gserviceaccount.com`.

Status actions may use:

```json
{
  "actionMethodName": "update_ticket_status",
  "ticketId": 123,
  "status": "resolved",
  "actorEmail": "agent@example.org",
  "actorName": "Support Agent"
}
```

Responses:

- `200`: action applied or marked duplicate
- `400`: missing ticket ID or invalid status
- `401`: missing or invalid Google Chat identity
- `502`: RT synchronization failed

Do not inject the dashboard admin header into this public callback route; that would bypass Google Chat identity verification.

## RT Operations

All routes in this section require the production admin header.

### `GET /api/rt/config`

Returns persisted configuration with RT token, webhook secret, and Chat webhook URL replaced by `[configured]`.

### `POST /api/rt/config`

Persists these fields when present:

```json
{
  "rtBaseUrl": "https://rt.example.org",
  "rtAuthToken": "token-value",
  "defaultQueue": "IT Support",
  "googleChatSpaceWebhookUrl": "https://chat.googleapis.com/...",
  "webhookSecret": "secret-value",
  "enableUserDm": false,
  "enableSpaceAlerts": true
}
```

Values equal to `[configured]` are ignored. Secret values are never returned in the response. Save `rtBaseUrl` before using the connection test.

### `POST /api/rt/test-connection`

Tests the saved RT base URL with `GET /REST/2.0/queues`. The requested URL must match the saved/configured base URL; credentials, query strings, fragments, redirects, and arbitrary targets are rejected.

Responses:

- `200`: RT returned a successful response
- `400`: invalid or unsaved base URL
- `502`: timeout, network failure, or non-success RT response

### `GET /api/rt/user-lookup?email=user%40example.org`

Looks up RT user by email. Returns `source: "rt_rest2"` when RT is queried, or `source: "offline_catalog"` when RT credentials are absent in development.

### `GET /api/rt/tickets`

Returns locally persisted ticket records received through webhooks or simulation.

### `GET /api/rt/tickets/:id`

Returns one locally persisted ticket. `404` means no local record exists; this route does not query RT directly.

### `PUT /api/rt/tickets/:id/status`

Updates RT status through the ticket's permission-filtered lifecycle hyperlink and updates local state only after RT succeeds.

```json
{
  "status": "resolved",
  "actorEmail": "agent@example.org"
}
```

Use `status` values supported by the ticket's RT lifecycle. Responses are `200` on success, `400` for invalid status, and `502` when RT rejects or cannot complete the update.

### `POST /api/rt/tickets/:id/correspond`

Posts correspondence through RT's permission-filtered `correspond` hyperlink.

```json
{
  "content": "Technician update",
  "actorEmail": "agent@example.org",
  "actorName": "Support Agent"
}
```

Send `X-Idempotency-Key` for retry-safe dashboard submissions. Responses are `200` on success, `400` for invalid content, and `502` for RT failures.

## Activity and Testing

### `GET /api/activity`

Returns webhook and Chat interaction logs. Credentials and sensitive payload fields are redacted.

### `DELETE /api/activity`

Clears local activity logs. It does not delete RT tickets or Chat messages.

### `GET /api/diagnostics`

Returns up to 150 in-memory diagnostic events from the current server process. Events include scope, level, duration, HTTP status, ticket ID, and safe error metadata. Tokens, raw request bodies, webhook signatures, and correspondence content are excluded. Restarting the process clears this buffer.

### `DELETE /api/diagnostics`

Clears the in-memory diagnostic buffer. It does not clear activity logs, tickets, or persisted configuration.

### `POST /api/webhooks/simulate`

Creates a local test ticket and runs the notification path without an RT webhook signature. Use only in explicit unauthenticated development mode or behind admin authentication; never expose it publicly.

Optional fields are `subject`, `queue`, `priority`, `requestor`, and `content`.

## Exposure Rules

Public reverse-proxy routes:

```text
/api/webhooks/rt-ticket-created
/api/chat/interactive
```

Keep dashboard and all other `/api` routes private or behind organizational authentication. The application listens on its internal port; TLS belongs at the reverse proxy.

Minimum reverse-proxy behavior:

- Terminate HTTPS before forwarding either public callback.
- Preserve the raw request body for `/api/webhooks/rt-ticket-created`.
- Forward `Authorization: Bearer ...` unchanged for `/api/chat/interactive`.
- Do not add dashboard admin headers to either public callback.
- Apply request size limits, timeouts, rate limits, and credential-redacted access logs.
- Return `404` or `403` for private paths when no organizational authentication is present; do not publish them as open proxy routes.

The application itself listens on its internal port. With Compose, production binds that port to localhost; with NixOS, expose it only through the host reverse proxy or an intentional firewall rule.
