# Operations

For initial setup, Google Cloud configuration, RT permissions, webhook Scrip code, and end-to-end verification, see [the setup guide](setup.md).

## Security

- Set `RT_WEBHOOK_SECRET` and require signed RT requests.
- Set `RT_CONNECT_ADMIN_TOKEN` and `CHAT_AUDIENCE` in production. The browser build must receive matching `VITE_RT_CONNECT_ADMIN_TOKEN`, or dashboard routes must be protected by a reverse proxy.
- Serve the application behind HTTPS.
- Do not expose `data/store.json` as static content.
- Configuration responses redact RT tokens and webhook secrets. Logs redact credential-shaped fields and do not store raw secrets.

## Reliability

Webhook events are deduplicated by event ID, or by a SHA-256 body fingerprint when no event ID is supplied. Correspondence operations support idempotency keys and only update local state after successful RT synchronization. Status updates use RT lifecycle links and ETags. RT mutation requests are not blindly retried; Google Chat delivery and safe RT reads use bounded retries.

RT status changes first retrieve the ticket, follow its permission-filtered `lifecycle` hyperlink, and send the returned `ETag` as `If-Match`. Queue-specific lifecycle rules therefore come from RT rather than a hard-coded status list. Correspondence follows RT's `correspond` hyperlink and is not blindly retried because REST2 does not provide POST idempotency.

## Recovery

Failed operations remain in activity logs with `failed` status. Re-submit using the same logical operation after resolving the remote failure. Atomic temporary-file replacement protects the JSON store from partial writes.
