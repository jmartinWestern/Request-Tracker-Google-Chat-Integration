# End-to-End Setup

This guide configures RT Connect for:

- Request Tracker REST2 ticket reads, status updates, and correspondence.
- Signed Request Tracker webhook events.
- Google Chat space card delivery through either an incoming webhook or the Chat API.
- Optional Firebase Google sign-in for the dashboard.
- NixOS deployment with sops-nix-managed secret files.

## Architecture

RT sends a signed HTTPS `POST` to:

```text
https://YOUR_HOST/api/webhooks/rt-ticket-created
```

RT Connect verifies the signature, looks up the requestor through RT REST2, builds a Google Chat card, and delivers it to the configured space. Dashboard and Chat card actions call RT REST2 for status changes or correspondence.

There are two independent Google Chat delivery modes:

1. Incoming webhook: simplest; posts to one fixed space.
2. Chat API service account: uses `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CHAT_SPACE_NAME`.

If both are configured, the incoming webhook is used first.

Direct requestor DMs are currently disabled and not implemented. Ticket-open notifications are sent to the technical staff space independently through `enableSpaceAlerts`. For an initial rollout, leave `enableUserDm = false` and `enableSpaceAlerts = true`.

## Google Cloud Project

### Create or select project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a dedicated project, or select an existing project owned by the organization.
3. Record the project ID. It is different from the display name.
4. Confirm the intended Google Workspace organization allows Chat apps and external integrations.

### Enable APIs

Open **APIs & Services > Library** and enable:

- **Google Chat API**, required for service-account Chat API delivery.
- **Identity Toolkit API**, only if using Firebase Authentication.

Incoming webhooks do not require a Google API key or service account.

### Google Chat API service-account mode

Use this mode when the application must call the Chat API instead of a fixed incoming webhook.

1. Open **IAM & Admin > Service Accounts**.
2. Create a dedicated service account, for example `rt-connect-chat`.
3. Do not grant project-wide Editor or Owner roles. Use the narrowest role required by the Chat API configuration.
4. Create a JSON key only if the host cannot use workload identity or another attached service-account identity.
5. Store the JSON key outside the repository. On NixOS, provide its path through `secrets.googleApplicationCredentialsFile`.
6. Open **Google Chat API > Configuration**.
7. Create or configure the Chat app with its name, avatar, description, and project/service-account identity as required by the current Google Cloud Console UI.
8. Enable interactive features and set the Chat app's HTTP endpoint URL to `https://YOUR_HOST/api/chat/interactive` when card buttons or Chat events are required.
9. Enable the app for the target Workspace organization and add it to the target Chat space.
10. Record the space resource name, such as `spaces/AAAA...`, not the human-readable space title.
11. Set `GOOGLE_CHAT_SPACE_NAME` to that resource name.

The application requests the `https://www.googleapis.com/auth/chat.bot` scope through `google-auth-library`. The service account must be authorized as the configured Chat app and be a member of, or otherwise permitted to post to, the target space.

When Google Chat sends an interactive event, it includes a bearer identity token. RT Connect verifies the token issuer and, in production, requires `CHAT_AUDIENCE` to match the audience value shown by the Chat app configuration. The endpoint must be publicly reachable over HTTPS by Google Chat.

### Incoming-webhook mode

Use this mode when one support space is sufficient.

1. Open the target Google Chat space.
2. Open the space menu and choose **Apps & integrations**, **Manage webhooks**, or the equivalent current UI label.
3. Create an incoming webhook with a recognizable name, such as `RT Connect`.
4. Copy the complete URL, including every query parameter.
5. Store the complete URL as `GOOGLE_CHAT_SPACE_WEBHOOK_URL` or in the configured secret file.

The URL's `key` and `token` query parameters authorize posting. Treat the entire URL as a secret. Do not paste it into source control, tickets, screenshots, or public documentation.

### API key clarification

RT Connect does not use a Google Cloud API key for Chat delivery:

- Incoming webhooks use the webhook URL's embedded key/token.
- Chat API delivery uses OAuth service-account credentials and the `chat.bot` scope.
- `firebase-applet-config.json` contains a browser Firebase API key. It is not an RT Connect server credential, but restrict it in Google Cloud Console by HTTP referrer and API scope.
- The RT REST2 token is created in RT, not Google Cloud.

Do not create a general-purpose Google API key as a substitute for the service-account JSON credential.

## Firebase Dashboard Authentication

Firebase authentication is optional for displaying the dashboard, but production API access also requires the configured RT Connect admin token.

1. Open [Firebase Console](https://console.firebase.google.com/) and create or select the project used by this deployment.
2. Add a Web app under **Project settings > Your apps**.
3. Enable **Authentication > Sign-in method > Google**.
4. Add the deployed dashboard hostname under **Authentication > Settings > Authorized domains**.
5. Confirm the matching OAuth client exists under **Google Cloud Console > APIs & Services > Credentials**.
6. Replace `firebase-applet-config.json` with the configuration for this Firebase project.
7. Restrict the Firebase browser API key to the dashboard origins and required Firebase APIs.

The browser configuration is not a place for RT tokens, webhook URLs, service-account JSON, or sops secret contents.

The current Firebase sign-in state is a dashboard UI feature; it is not the server-side authorization mechanism for `/api` routes. In production, the compiled dashboard must send `VITE_RT_CONNECT_ADMIN_TOKEN`, or a private reverse proxy must enforce equivalent authentication before forwarding dashboard requests.

## Request Tracker REST2

### Prepare an integration user

Create a dedicated RT user for RT Connect. Do not use `root` or a personal administrator account.

The exact rights depend on queue policy and lifecycle configuration. The integration user generally needs:

- `SeeQueue` for configured queues.
- `SeeTicket` or `ShowTicket` for tickets it will read.
- `ModifyTicket` for status changes.
- `ReplyToTicket` for correspondence.
- `CommentOnTicket` if comments are added in future.
- User lookup rights appropriate for the requestor search, commonly `SeeUser`.

Grant rights only in the queues and records required by this integration. RT lifecycle hyperlinks are permission-filtered, so missing rights appear as missing actions rather than as a locally inferred status list.

### Create REST2 token

RT 6 supports token authentication through `RT::Authen::Token`:

1. Ensure the `RT::Authen::Token` extension is enabled.
2. Sign in as the dedicated integration user.
3. Open **Logged in as ... > Settings > Auth Tokens**.
4. Create a token with a descriptive name, such as `rt-connect-production`.
5. Copy it once and store it as `RT_AUTH_TOKEN` or in the configured secret file.

The application sends:

```http
Authorization: token RT_TOKEN
Accept: application/json
```

The configured base URL must be the RT origin, without `/REST/2.0`, for example:

```text
https://rt.example.org
```

The application then uses REST2 endpoints and follows RT-provided `_url` and `_hyperlinks` values. Status updates use the ticket `ETag` with `If-Match`; correspondence follows the ticket's `correspond` hyperlink.

### Test REST2 access

From a trusted host, test the same token used by the service:

```bash
curl --fail-with-body \
  -H "Authorization: token $RT_AUTH_TOKEN" \
  -H 'Accept: application/json' \
  "$RT_BASE_URL/REST/2.0/queues/all"
```

Then test a ticket the integration user can access:

```bash
curl --fail-with-body \
  -H "Authorization: token $RT_AUTH_TOKEN" \
  -H 'Accept: application/json' \
  "$RT_BASE_URL/REST/2.0/ticket/123"
```

The ticket response should include `_hyperlinks`. Lifecycle links contain `ref: "lifecycle"`, `from`, `to`, `label`, `update`, and `_url`. Missing `correspond` or lifecycle links indicate an RT permission or queue-lifecycle issue.

## RT Webhook

### Secret

Generate a separate high-entropy webhook secret. Do not reuse the RT REST2 token or a Google credential.

```bash
openssl rand -hex 32
```

Set it as `RT_WEBHOOK_SECRET` or provide its runtime file path. Production requests must include:

- `X-RT-Timestamp`: Unix timestamp in seconds.
- `X-RT-Signature`: `sha256=` followed by a lowercase or uppercase HMAC-SHA256 hex digest.
- Optional `X-RT-Event-Id`: stable unique event identifier.

The signed message is exactly:

```text
${timestamp}.${raw HTTP request body}
```

The body must be signed before any JSON parsing or whitespace reformatting. Timestamps older than `SIGNATURE_MAX_AGE_SECONDS` are rejected. The default maximum age is 300 seconds.

### Payload

Example event:

```json
{
  "eventId": "rt-transaction-9876",
  "event": "ticket_created",
  "ticket": {
    "id": 123,
    "Subject": "Cannot print from library lab",
    "Queue": "IT Support",
    "Status": "new",
    "Priority": "High",
    "Requestor": "user@example.org",
    "RequestorName": "Example User",
    "Created": "2026-10-15T12:00:00Z",
    "Content": "Printer is unavailable.",
    "Url": "https://rt.example.org/Ticket/Display.html?id=123"
  }
}
```

`ticket.id`, `ticket.Subject`, `ticket.Requestor`, and the ticket status format are validated. Request bodies are limited by `MAX_BODY_BYTES`.

### RT Scrip action

Create an RT Scrip that runs on ticket creation or the transaction events required by the integration. The custom action must:

1. Build the JSON payload.
2. Serialize it once.
3. Compute HMAC over the exact serialized bytes.
4. Send the HTTPS request with the signature headers.
5. Log only HTTP status and non-sensitive diagnostic information.

Illustrative Perl action code:

```perl
use strict;
use warnings;
use Digest::SHA qw(hmac_sha256_hex);
use HTTP::Request;
use JSON qw(encode_json);
use LWP::UserAgent;

my $endpoint = 'https://rt-connect.example.org/api/webhooks/rt-ticket-created';
my $secret = 'LOAD_FROM_RT_SERVER_SECRET_STORE';
my $timestamp = time;
my $ticket = $self->TicketObj;
my $requestor = $ticket->Requestors->UserMembersObj->First;

my $payload = {
    eventId => 'rt-transaction-' . $self->TransactionObj->Id,
    event => 'ticket_created',
    ticket => {
        id => 0 + $ticket->Id,
        Subject => $ticket->Subject,
        Queue => $ticket->QueueObj->Name,
        Status => $ticket->Status,
        Priority => $ticket->Priority,
        Requestor => $requestor ? $requestor->EmailAddress : '',
        RequestorName => $requestor ? $requestor->RealName : '',
        Created => "$ticket->Created",
        Content => $self->TransactionObj->Content || '',
        Url => 'https://rt.example.org/Ticket/Display.html?id=' . $ticket->Id,
    },
};

my $body = encode_json($payload);
my $signature = hmac_sha256_hex($timestamp . '.' . $body, $secret);
my $request = HTTP::Request->new(POST => $endpoint);
$request->header('Content-Type' => 'application/json');
$request->header('X-RT-Timestamp' => $timestamp);
$request->header('X-RT-Signature' => 'sha256=' . $signature);
$request->header('X-RT-Event-Id' => 'rt-transaction-' . $self->TransactionObj->Id);
$request->content($body);

my $response = LWP::UserAgent->new(timeout => 10)->request($request);
RT::Logger->error('RT Connect webhook failed: ' . $response->status_line)
    unless $response->is_success;
return 1;
```

Replace the endpoint and secret-loading placeholder according to the RT deployment's secret-management policy. Never put the production secret directly in a tracked Scrip export. The dashboard's generated legacy Scrip example uses a body `secretToken` compatibility path and is not sufficient for production signed requests.

### Webhook test

Use a temporary body file so the signature covers the exact bytes sent:

```bash
body='{"eventId":"manual-1","event":"ticket_created","ticket":{"id":123,"Subject":"Webhook test","Queue":"IT Support","Status":"new","Priority":"Low","Requestor":"user@example.org"}}'
timestamp="$(date +%s)"
signature="$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$RT_WEBHOOK_SECRET" -hex | cut -d' ' -f2)"
curl --fail-with-body -X POST "$RT_CONNECT_URL/api/webhooks/rt-ticket-created" \
  -H 'Content-Type: application/json' \
  -H "X-RT-Timestamp: $timestamp" \
  -H "X-RT-Signature: sha256=$signature" \
  -H 'X-RT-Event-Id: manual-1' \
  --data-binary "$body"
```

The first request processes the ticket. Repeating it with the same event ID returns a duplicate response and does not send another notification.

## Environment Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production: yes | `production` enables strict admin and Chat identity checks. |
| `PORT` | No | Listen port; default `3000`. |
| `RT_BASE_URL` | Production: yes | RT origin, without `/REST/2.0`. |
| `RT_AUTH_TOKEN` or `RT_AUTH_TOKEN_FILE` | Production: yes | RT REST2 token. |
| `RT_WEBHOOK_SECRET` or `RT_WEBHOOK_SECRET_FILE` | Production: yes | RT webhook HMAC secret. |
| `GOOGLE_CHAT_SPACE_WEBHOOK_URL` or file | Optional | Complete incoming webhook URL. |
| `GOOGLE_CHAT_SPACE_NAME` | API mode | Chat space resource, such as `spaces/AAA`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | API mode | Path to service-account JSON. |
| `RT_ENABLE_USER_DM` | No | Controls future direct requestor DMs; default `false`. Current builds report DMs as unavailable and do not send them. |
| `RT_ENABLE_SPACE_ALERTS` | No | Sends ticket cards to the configured technical staff space; default `true`. |
| `RT_CONNECT_ADMIN_TOKEN` or file | Production: yes | Protects dashboard/API routes. |
| `VITE_RT_CONNECT_ADMIN_TOKEN` | Browser build | Header value used by the compiled dashboard. This is exposed to browsers; prefer a reverse-proxy auth boundary instead of treating it as a secret. |
| `CHAT_AUDIENCE` | Production: yes | Expected Google Chat bearer-token audience for interactive callbacks. |
| `MAX_BODY_BYTES` | No | JSON request limit; default `131072`. |
| `SIGNATURE_MAX_AGE_SECONDS` | No | Webhook freshness window; default `300`. |
| `OUTBOUND_TIMEOUT_MS` | No | RT/Chat request timeout; default `8000`. |
| `MAX_RETRIES` | No | Retry count for safe outbound operations such as Chat delivery. |
| `RT_CONNECT_DATA_DIR` | NixOS | Mutable state directory; set by the NixOS module. |

Do not set both a plaintext variable and its `_FILE` variant to different values. The `_FILE` value wins and is read at process startup.

## NixOS and sops-nix

The module is enabled with `services.requestTrackerGoogleChat`. It creates:

- User and group `request-tracker-google-chat` by default.
- State directory `/var/lib/request-tracker-google-chat`.
- Systemd unit `request-tracker-google-chat.service`.
- Network-online ordering and restart-on-failure behavior.
- Restrictive systemd filesystem and privilege settings.

Example secret declarations:

```nix
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
sops.secrets.google-chat-webhook = {
  owner = "request-tracker-google-chat";
  group = "request-tracker-google-chat";
  mode = "0400";
};
sops.secrets.google-chat-service-account = {
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
```

For Chat API mode, replace `googleChatSpaceWebhookUrlFile` with:

```nix
googleChatSpaceName = "spaces/AAA...";
secrets.googleApplicationCredentialsFile = config.sops.secrets.google-chat-service-account.path;
```

The service account JSON file must be readable by the service user and must not be copied into the Nix store. The module checks its readability before starting the service.

Build and inspect the deployment:

```bash
nix build .#default
nix flake check
sudo nixos-rebuild switch --flake .#YOUR_HOST
systemctl status request-tracker-google-chat
journalctl -u request-tracker-google-chat -f
```

The application flake exports a package and module, not a host configuration. A host's NixOS flake must import the module and define its own `nixosConfigurations` entry:

```nix
{
  inputs.rt-connect.url = "github:YOUR_ORG/Request-Tracker-Google-Chat-Integration";

  outputs = { nixpkgs, rt-connect, ... }:
    {
      nixosConfigurations.rt-host = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./hardware-configuration.nix
          rt-connect.nixosModules.default
          ({ config, ... }: {
            services.requestTrackerGoogleChat = {
              enable = true;
              rtBaseUrl = "https://rt.example.org";
              chatAudience = "GOOGLE_CHAT_AUDIENCE_FROM_CHAT_APP_CONFIG";
              secrets = {
                rtAuthTokenFile = config.sops.secrets.rt-api-token.path;
                rtWebhookSecretFile = config.sops.secrets.rt-webhook-secret.path;
                adminTokenFile = config.sops.secrets.rt-admin-token.path;
                googleChatSpaceWebhookUrlFile = config.sops.secrets.google-chat-webhook.path;
              };
            };
          })
        ];
      };
    };
}
```

Run `nixos-rebuild` against that host flake, for example `sudo nixos-rebuild switch --flake /etc/nixos#rt-host`. If the repository is checked out directly on the NixOS host, use a local path input such as `rt-connect.url = "path:/srv/rt-connect"`.

Secret rotation requires restarting the unit after sops-nix updates the files:

```bash
sudo systemctl restart request-tracker-google-chat
```

## Reverse Proxy and Network

Expose `/api/webhooks/rt-ticket-created` publicly through an HTTPS reverse proxy. Also expose `/api/chat/interactive` when Google Chat card actions or Chat app events are enabled. Keep dashboard and administration routes private or behind organizational authentication. Forward the original request body unchanged to preserve HMAC verification.

Required outbound connectivity:

- RT Connect to RT HTTPS REST2 endpoint.
- RT to RT Connect webhook endpoint.
- RT Connect to `chat.googleapis.com` when using Chat API or an incoming webhook.
- Browser to RT Connect over HTTPS for dashboard use.

Do not terminate TLS at RT Connect itself without a separate certificate and hardening plan. A reverse proxy should set request size limits, access logs with credential redaction, and timeouts. The proxy must either pass the browser's `X-RT-Connect-Admin-Token` header or enforce its own authentication and inject the trusted header upstream; otherwise production dashboard API calls return `401`.

## Verification Checklist

1. `nix flake check` passes; this validates the package and module output shape.
2. RT REST2 `queues/all` succeeds with the integration token.
3. RT ticket GET returns lifecycle and correspondence hyperlinks.
4. `GET /api/rt/config` returns redacted credentials.
5. A signed webhook returns HTTP 200.
6. Replaying the same event ID returns `duplicate: true`.
7. A malformed or stale signature returns HTTP 401.
8. A valid status transition updates RT and the dashboard.
9. An invalid queue-specific transition returns an error without changing local state.
10. A correspondence action follows RT's `correspond` permission and records the result.
11. Google Chat receives exactly one card for the webhook event.
12. Confirm requestor DM status is `skipped` and staff-space delivery is `sent`.
13. Restarting the service after sops rotation loads new secret values.

## Troubleshooting

### `401 Invalid or missing RT webhook signature`

Check that the HMAC uses the exact raw body, Unix seconds, the same secret, and the `timestamp.body` input format. Check system clock skew.

### `RT does not expose permitted lifecycle transition`

The target status is not valid for the ticket's current queue lifecycle, or the integration user lacks the required RT right. Inspect the ticket `_hyperlinks` response.

### `RT user not found`

Confirm the requestor email exists in RT and the integration user can search users. RT Connect does not fabricate RT user IDs.

### Google Chat returns `401`, `403`, or `404`

For webhook mode, regenerate or recopy the complete webhook URL and verify the space still exists. For API mode, verify the service-account JSON path, Chat API enablement, Chat app configuration, space resource name, app membership, and Workspace administrator policy.

### Service starts then exits

Run `journalctl -u request-tracker-google-chat`. Missing or unreadable production secret files fail startup intentionally. Confirm sops-nix has deployed files before the service starts and that ownership permits reads.

### Dashboard API returns `401`

Production API routes require `RT_CONNECT_ADMIN_TOKEN`. The compiled browser dashboard sends `VITE_RT_CONNECT_ADMIN_TOKEN`; it must be set at build time. Do not expose the admin token through a public build without an additional reverse-proxy authentication boundary.
