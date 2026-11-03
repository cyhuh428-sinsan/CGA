# External channel connection operations

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. Scope and verification boundary

This guide covers the new Teams, Slack, Discord, Telegram, Google Chat and LINE connection panel, not a replacement for existing Webchat, Kakao, Teams or bot-authoring flows. It describes a development candidate checked against source and synthetic tests. Actual platform configuration screens, real accounts/secrets, external roundtrips, production readiness and user acceptance remain **unverified**. Platform preparation below is a checklist for an authorized configurator, not evidence that configuration was performed.

## 2. Prerequisites

- The system operator confirms the exact candidate commit/image, backup/rollback and authorization. Users should not manipulate the DB or CLI themselves.
- `CHANNEL_CONNECTION_WORKER_ENABLED=false` by default. Saving and checking settings make no external calls. Enable the worker and attempt live connection only after separate authorization.
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` must encode **32 bytes** in Base64; `CHANNEL_CONNECTION_KEY_VERSION` defaults to `v1`. Never put values in screenshots, Git or logs. Missing/damaged keys and AAD mismatches fail closed.
- The API packet bridge requires **Node 22**, shared conversion assets and an executable `CHANNEL_CONNECTION_NODE_BINARY`. Tests under another local Node version do not verify the Node 22 image.
- The operator verifies the additive chain `20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030` on an approved target. It adds connection, lease, room-mapping and delivery tables without migrating existing records. Production DB application needs separate approval.
- Organization, group, answer bot and parent channel must be active, with a runnable bot version. Confirm organization-administrator access and platform app-management permissions.

## 3. Register, connect and disconnect in the UI

1. Sign in as an administrator and open `Admin > Channel management`. Select the existing channel type, confirm it is active and open `Connections` on a supported row.
2. Choose `Add connection`; enter name, answer bot, installation/workspace ID, external bot account ID and room/channel ID from section 4. Display names and invitation URLs are not IDs.
3. Enter only the displayed credential fields and `Save settings`. Credentials are required initially. On edit, blank fields preserve stored values; nonblank fields merge into them. Never paste “Registered”, stars or masked placeholders as secrets. Stored secrets are not displayed again.
4. Run `Check settings` and inspect the last-check time/error. This checks format, required fields and active resources, not external identity or permissions. “Settings valid · external access unverified” is not a connection success.
5. After live-communication approval and server preparation, choose `Connect`. The request initially becomes `Connecting`; the worker must verify identity, target and exclusive scope. Teams, Google Chat and LINE also need the first authenticated target event. Send one approved test question, reopen the panel and compare the observed state with the actual bot reply. The first question is preserved for processing.
6. Choose `Disconnect` and confirm `Disconnected` before editing or deleting. Disconnect even an error row if its connection request remains active. Delete soft-deletes settings while preserving conversation history. A parent with connection rows cannot freely change provider or be deleted.

## 4. IDs and credential fields

| Provider | installation_id | account_id | target_id | Required credentials / optional |
|---|---|---|---|---|
| Teams (`ms_teams`) | tenant UUID | app client UUID | Teams channel ID, otherwise conversation ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | workspace/team ID | bot **user** ID | accessible conversation ID | `bot_token`, `app_token` / optional `signing_secret` |
| Discord (`discord`) | guild ID or `DM` for one-to-one | bot user ID | channel/thread/DM ID | `bot_token` |
| Telegram (`telegram`) | numeric bot user ID | same numeric bot user ID | private/group/supergroup chat ID | `bot_token` |
| Google Chat (`google_chat`) | numeric **Project Number** | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / optional matching `project_id` |
| LINE (`line`) | bot user ID: `U` + 32 lowercase hex digits | same bot user ID | user `U…`, group `C…`, room `R…` | `access_token`, `channel_secret` |

External IDs are sensitive operational data: do not copy real IDs into public documents, errors, logs or PRs. Braced identifiers are explanatory placeholders, not values to save. Other credential fields are rejected.

## 5. Teams preparation and checks

An authorized app/bot configurator confirms Bot Connector tenant/client/secret, Teams channel enablement and app installation in the target. Credential tenant/client must match section 4. Configure the approved HTTPS callback path `/api/v1/channel-connections/ms-teams/events`; `https://example.com/api/v1/channel-connections/ms-teams/events` is only a reserved example, not a live address.

Obtaining OAuth tokens alone does not mean `Connected`. Microsoft JWT signature, issuer, audience, tenant/app, authenticated service URL and target activity must match. Send the first authenticated bot-directed activity after connection; verify question preservation, one CGA answer and the correct conversation. Invalid authentication or tenant/target must not execute the bot. On failure, disconnect, investigate installation/IDs/endpoint and validate using a new question. [Official Teams documentation](https://learn.microsoft.com/en-us/microsoftteams/platform/).

## 6. Slack preparation and checks

Prepare a bot token and a **separate app-level token** from the same app/workspace. The app token needs `connections:write`; enable Socket Mode and the required events/interactions. Confirm bot permissions for the intended usage: `chat:write`, `bots:read`, appropriate conversation reads (`channels:read`, `groups:read`, `im:read`, etc.) and mention/message subscriptions. Scope changes/reinstallation are separate authorization boundaries. Invite the bot to a nonarchived target.

Reception uses outbound Socket Mode, not a public callback. App ID, bot ID and bot user ID differ; account uses the bot user ID. Optional `signing_secret` does not provide a new public HTTP signature receiver. Validate DM or bot-mention questions, threaded answers, choices and no duplicate reply for the same event. For `SLACK_IDENTITY_VERIFICATION_FAILED`, `missing_scope` or `not_in_channel`, disconnect and check identity/permissions/membership. Do not run a competing receiver for the exclusive app scope. [Official Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## 7. Discord preparation and checks

Install the bot in the target guild and check effective overwrites: View Channel, Send Messages or Send Messages in Threads, and Embed Links when needed. Private threads require bot membership; archived/locked threads are rejected. One-to-one targets use the actual DM channel ID and installation `DM`; group DMs are excluded.

Reception uses Gateway without a public callback. Current Identify intents are `4609` (`GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`), not `MESSAGE_CONTENT`; do not promise access to every ordinary message. Verify mention/DM and card choices with the actual app configuration without arbitrarily expanding privileges. Check guild/channel/account mismatch and access failure, then reconnect/resume without duplicate replies. The app scope is exclusive; disconnect before correcting settings. [Official Gateway/intents](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx).

## 8. Telegram preparation and checks

Confirm the bot token, numeric bot ID and target chat ID. Installation/account are the same numeric ID, not username. In private chat the user starts the bot first; groups/supergroups require membership, send permission and photo permission where used. Broadcast channels are excluded. Verify actual mention/command/reply reception under privacy settings.

Reception uses `getUpdates` long polling, not a callback, and must not compete with another poller. An existing webhook blocks with `TELEGRAM_WEBHOOK_EXISTS`; it is **not automatically deleted**. Confirm impact and switching approval first. Check private or bot-directed group questions, choices, answers, offset recovery and deduplication. Disconnect stops polling; it does not switch webhooks or delete backlog automatically. [Official Bot API](https://core.telegram.org/bots/api#getupdates).

## 9. Google Chat preparation and checks

Use an **HTTP Chat app that is not a Google Workspace add-on**, with authentication audience **Project Number JWT**. URL-audience ID tokens/add-on payloads are not supported here. Callback path: `/api/v1/channel-connections/google-chat/events`. Distinguish numeric Project Number, string project ID, bot `users/{bot-id}` and target `spaces/{space-id}`.

Prepare the same project's RSA service-account JSON (type, project_id, client_email, private_key_id, private_key and fixed Google token_uri). Optional `project_id` must match the JSON. The configurator checks Chat API/project lookup availability, OAuth scopes `chat.bot` and `cloudplatformprojects.readonly`, project metadata-read permission and app membership in the target space. Do not enter a service-account email or project ID as the account.

Even successful project-number/active-project and space checks need a first Google-signed target event to activate. Require signature, issuer, exact numeric audience, matching bot/space and verified reply sender. Test DM or space mention, thread reply, actual card-choice value and deduplication. Do not ignore `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`, `GOOGLE_CHAT_TARGET_VERIFICATION_FAILED` or `GOOGLE_CHAT_SENDER_VERIFICATION_FAILED`: disconnect and investigate. Check exclusive project scope and impact on existing apps. [Official request verification](https://developers.google.com/workspace/chat/verify-requests-from-chat).

## 10. LINE preparation and checks

Prepare the Messaging API channel/Official Account access token, channel secret and **bot user U-ID** from bot information. Both installation and account use this U-ID, **not the separate numeric channel ID** in the console. Target is a user U-ID, group C-ID or room R-ID. Confirm friendship/group membership, messaging permissions, group reception settings and possible duplicate replies from existing auto-replies.

Callback path: `/api/v1/channel-connections/line/events`. Proxies must not transform the body: `X-Line-Signature` HMAC is verified over **raw bytes before JSON parsing**. Bot API identity alone is insufficient; the first valid signed target event activates the connection. Check text, postback choice, redelivery handled once and invalid signature rejected without execution.

Reply tokens are single-use. The implementation uses a conservative window of **less than 55 seconds** since receipt and, for redelivery, **less than 20 minutes** since the original event. Official timing is not a delay guarantee. Do not automatically retry expired/uncertain sends using push or a new token. Reissuing the channel secret invalidates existing signatures and needs impact review and separate approval. [Official signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [Official reply rules](https://developers.line.biz/en/reference/messaging-api/#send-reply-message).

## 11. States and errors

| State/code | Meaning and action |
|---|---|
| `disconnected`, `connecting`, `connected`, `disconnecting`, `error` | Observed state, not merely request acceptance. Even connected does not prove a complete roundtrip or acceptance. |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | Ask the operator to recover key/version/ciphertext; never print or arbitrarily replace them. |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | Recheck required values, field names and ID distinctions. Saving does not establish provider validation. |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | Check existing targets or disconnect first; do not blindly delete rows. |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | Operator checks worker/Node bridge; do not bypass the gate. |
| `LEASE_EXPIRED`, scope/identity errors | Reopen the list; report code/time and redacted evidence. Never edit lease/fence directly in DB. |
| Auth 401/403, size 413, format 422, disabled receiver 503 | Check signature/body/size/server readiness. Receiver HTTP 200 alone does not prove a bot reply. |

UI may show only safe codes or generic errors. Do not publish raw external API errors. Reopen the panel instead of assuming automatic refresh.

## 12. Safe stop, recovery and limitations

Disconnect to stop new work; the operator may disable the worker (`false`). Cancellation cannot guarantee recall of already-started remote HTTP sends. `unknown` delivery means uncertain outcome: **never automatically execute/send again or delete the ledger**. The panel has no unknown-reprocessing tool. An operator must compare provider records and the internal ledger privately and obtain a separate decision. Reconnecting does not authorize replay of an old unknown.

Disable the worker before reverting a verified PR/commit normally. Migration downgrade is allowed only with empty new tables. Existing connection/runtime data must cause refusal; do not force downgrade/delete data. Follow an approved backup/preservation plan. Deleting a setting does not erase all conversations/deliveries.

There is no automatic master-key/version rotation or re-encryption tool. Ciphertext is bound to its original key and organization/connection/version AAD; changing environment key alone breaks decryption. Rotate provider credentials only after authorization: disconnect, edit, check, reconnect; a fresh identity event may be required. Immediate memory credential/token-cache erasure, cache lifetime cleanup and long-lived cursor/receipt growth/retention remain limitations. Disconnect/delete does not promise removal of all caches/receipts. Emergency revocation requires an operator process/provider-revocation plan and approval.

## 13. Candidate verification checklist

| Provider | Development evidence | Real platform |
|---|---|---|
| Teams | Implemented; synthetic JWT/native/packet checks | Unverified |
| Slack | Implemented; synthetic Socket Mode/native checks | Unverified |
| Discord | Implemented; synthetic Gateway/native checks | Unverified |
| Telegram | Implemented; synthetic polling/native checks | Unverified |
| Google Chat | Implemented; synthetic JWT/native/choice checks | Unverified |
| LINE | Implemented; synthetic HMAC/native/reply-token checks | Unverified |

This distinguishes Tasks 1–11 development evidence only. Check the exact candidate's separate record for full API/Web tests, migration/Node22 images, skips and exact SHA. It is not live-platform PASS.

- An authorized tester must follow registration → check → connect → real receive → CGA execution → reply → choice → disconnect/reconnect for each provider in the UI.
- Verify authentication failure, wrong target/organization, duplicate/redelivery, restart and timeout/unknown produce no duplicate execution/send. Record commit/image, time, result/unverified and rollback without real IDs/secrets.
- Real secret creation/registration, permission changes, external calls/cost, production DB migration and Oracle/production deployment each require applicable separate authorization. Paid-LLM answer bots additionally require model/count/budget/stop conditions. This document is not execution approval.

## 14. Source cross-check

[UI](../../apps/web/components/channel-connections-panel.tsx), [fields/client](../../apps/web/lib/channel-connections-api.ts), [admin API](../../apps/api/app/api/routes/channel_connections.py), [crypto](../../apps/api/app/services/channel_connections.py), [receivers](../../apps/api/app/api/routes/channel_connection_events.py), [supervisor](../../apps/api/app/services/channel_connection_supervisor.py), [runtime](../../apps/api/app/services/channel_connection_runtime.py), [Teams](../../apps/api/app/services/channel_connection_teams.py), [Slack](../../apps/api/app/services/channel_connection_slack.py), [Discord](../../apps/api/app/services/channel_connection_discord.py), [Telegram](../../apps/api/app/services/channel_connection_telegram.py), [Google Chat](../../apps/api/app/services/channel_connection_google_chat.py), [Google auth](../../apps/api/app/services/channel_connection_google_chat_auth.py), [LINE](../../apps/api/app/services/channel_connection_line.py), [migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py), [settings](../../apps/api/app/core/config.py).
