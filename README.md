# RT Connect

RT Connect provides a React operations dashboard and Express integration API for Request Tracker and Google Chat.

See [the complete setup guide](docs/setup.md) for Google Cloud, Google Chat, Firebase, RT REST2, signed webhooks, sops-nix, NixOS, verification, and troubleshooting.

## Development

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `RT_WEBHOOK_SECRET`.
3. Run `npm run test`.
4. Run `npm run lint` and `npm run build`.
5. Run `npm run dev`.

The dashboard uses seeded local data when RT credentials are absent. Production mode requires `RT_CONNECT_ADMIN_TOKEN`; configure the same value as `VITE_RT_CONNECT_ADMIN_TOKEN` for browser access.

## Integration Routes

- `POST /api/webhooks/rt-ticket-created`: signed RT event ingress. Send `X-RT-Timestamp`, `X-RT-Signature`, and optional `X-RT-Event-Id`. Signature is HMAC-SHA256 over `timestamp.raw_body`.
- `POST /api/chat/interactive`: Google Chat card actions or dashboard status actions.
- `POST /api/rt/tickets/:id/correspond`: validated internal RT correspondence.
- `PUT /api/rt/tickets/:id/status`: validated RT status update.
- `GET /api/rt/config`: safe configuration view; credentials are redacted.

Never commit `.env`, RT tokens, webhook secrets, or `data/store.json` containing runtime records.

## NixOS

The flake supports `x86_64-linux` and exposes `packages.x86_64-linux.default` plus `nixosModules.default`.

```bash
nix build .#default
nix flake check
```

Enable the service with `services.requestTrackerGoogleChat`. Production mode requires runtime file paths for the RT token, RT webhook secret, and dashboard admin token. Configure those paths from sops-nix without reading secret contents during evaluation:

```nix
{
  sops.secrets.rt-api-token = {
    owner = "request-tracker-google-chat";
    group = "request-tracker-google-chat";
    mode = "0400";
  };
  sops.secrets.rt-webhook-secret = {
    owner = "request-tracker-google-chat";
    group = "request-tracker-google-chat";
    mode = "0400";
  };
  sops.secrets.rt-admin-token = {
    owner = "request-tracker-google-chat";
    group = "request-tracker-google-chat";
    mode = "0400";
  };

  services.requestTrackerGoogleChat = {
    enable = true;
    rtBaseUrl = "https://rt.example.org";
    chatAudience = "GOOGLE_CHAT_AUDIENCE_FROM_CHAT_APP_CONFIG";
    enableUserDm = false;
    enableSpaceAlerts = true;
    secrets = {
      rtAuthTokenFile = config.sops.secrets.rt-api-token.path;
      rtWebhookSecretFile = config.sops.secrets.rt-webhook-secret.path;
      adminTokenFile = config.sops.secrets.rt-admin-token.path;
      googleChatSpaceWebhookUrlFile = config.sops.secrets.google-chat-webhook.path;
    };
  };
}
```

Use `secrets.googleChatSpaceWebhookUrlFile` for incoming webhooks, or set `googleChatSpaceName` and provide `secrets.googleApplicationCredentialsFile` for Google Chat API delivery. Production also requires `chatAudience`. Secret rotation takes effect after restarting `request-tracker-google-chat`. See [the complete setup guide](docs/setup.md) for the external host-flake configuration required by `nixos-rebuild`.
