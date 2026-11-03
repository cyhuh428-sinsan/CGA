# 外部チャネル接続の運用ガイド

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. 範囲と検証境界

Teams、Slack、Discord、Telegram、Google Chat、LINE の新しい接続パネルを説明します。従来の Webchat・Kakao・Teams やボット制作を置き換えません。ソースと合成テストに基づく開発候補の案内です。実際のプラットフォーム設定画面、実アカウント・Secret、外部送受信、本番準備、ユーザー受入れは**未検証**です。以下の準備は許可された設定担当者の確認事項であり、実施済み記録ではありません。

## 2. 前提条件

- システム担当者が正確な候補 commit/image、バックアップ・復旧、承認範囲を確認します。一般ユーザーは DB/CLI を直接操作しません。
- `CHANNEL_CONNECTION_WORKER_ENABLED=false` が既定です。保存・設定検査は外部通信を行いません。worker 有効化と実接続は別途承認後に行います。
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` は **32バイト**を Base64 化したキーです。`CHANNEL_CONNECTION_KEY_VERSION` の既定は `v1`。値を画面、Git、ログに残しません。欠落・破損・AAD 不一致は外部接続せず失敗します。
- API packet bridge には **Node 22**、共有変換資産と実行可能な `CHANNEL_CONNECTION_NODE_BINARY` が必要です。別のローカル Node のテストで Node22 image 検証を代用しません。
- 担当者が承認された対象で additive migration `20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030` を検証します。接続・lease・ルーム対応・delivery テーブルのみ追加し既存記録は移行しません。本番 DB には別承認が必要です。
- 組織・グループ・回答ボット・親チャネルが有効で、ボット実行バージョンが必要です。組織管理者権限とプラットフォームのアプリ管理権限を確認します。

## 3. 画面での登録・接続・解除

1. 管理者で `Admin > チャネル管理` を開き、既存の種類と有効状態を確認し対応行の `接続先` を開きます。
2. `接続先を追加` で名前・回答ボット・インストール/ワークスペース ID・外部ボットアカウント ID・ルーム/チャネル ID を入力します。第4節に従い、表示名や招待 URL を使いません。
3. 表示された認証項目だけを入力し保存します。初回は必須、編集時の空欄は既存値を保持し非空欄だけマージします。「登録済み」、星印、マスクを Secret として貼り付けません。保存済み Secret は再表示しません。
4. `設定を検査` 後、最終検査時刻とエラーを確認します。形式・必須項目・有効状態の検査であり外部の身元や権限は確認しません。「設定は有効・外部接続は未確認」は接続成功ではありません。
5. 実通信承認とサーバー準備後 `接続` を押します。最初は `接続中` で、worker が身元・対象・排他的 scope を検証します。Teams/Google Chat/LINE は最初の認証済み対象イベントも必要です。許可された質問を1回送り、パネルを開き直して状態と実返信を確認します。最初の質問も保持・処理されます。
6. 編集・削除前に `接続解除` して `未接続` を確認します。エラーでも接続要求が残れば解除します。削除は設定の soft-delete で会話履歴は保持します。接続行のある親は provider 変更・削除が制限されます。

## 4. ID と認証項目

| 種類 | installation_id | account_id | target_id | 必須認証 / 任意 |
|---|---|---|---|---|
| Teams (`ms_teams`) | tenant UUID | app client UUID | Teams channel ID、なければ conversation ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | workspace/team ID | bot **user** ID | アクセス可能な conversation ID | `bot_token`, `app_token` / 任意 `signing_secret` |
| Discord (`discord`) | guild ID、1対1は `DM` | bot user ID | channel/thread/DM ID | `bot_token` |
| Telegram (`telegram`) | 数値 bot user ID | 同じ数値 bot user ID | private/group/supergroup chat ID | `bot_token` |
| Google Chat (`google_chat`) | 数値 **Project Number** | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / 一致する `project_id` は任意 |
| LINE (`line`) | bot user ID：`U`+小文字hex32桁 | 同じ bot user ID | user `U…` / group `C…` / room `R…` | `access_token`, `channel_secret` |

外部 ID も機微な運用情報です。実値を公開資料・エラー・ログ・PR に転記しません。波括弧は説明用でそのまま保存しません。許可外の認証項目は拒否されます。

## 5. Teams の準備と確認

権限のある担当者が Bot Connector の tenant/client/secret、Teams channel 有効化と対象へのアプリ導入を確認します。認証 tenant/client は表と一致させます。承認済み HTTPS callback のパスは `/api/v1/channel-connections/ms-teams/events`（`https://example.com/api/v1/channel-connections/ms-teams/events` は架空の例）です。

OAuth token 取得だけでは接続済みになりません。Microsoft JWT の署名・issuer・audience・tenant/app、認証 service URL、対象 activity が一致する必要があります。最初の認証済み呼びかけを送り、初問保持・CGA 返信1回・正しい会話を確認します。不正な認証/tenant/target では実行されないことを確認します。失敗時は解除し導入/ID/endpoint を調べ、新しい質問で検証します。[公式 Teams 文書](https://learn.microsoft.com/en-us/microsoftteams/platform/)。

## 6. Slack の準備と確認

同じ app/workspace の bot token と**別の app-level token**を用意します。app token の `connections:write`、Socket Mode、必要イベント/interaction を確認します。bot の `chat:write`、`bots:read`、対象別 conversation 参照（`channels:read`、`groups:read`、`im:read` 等）と mention/message 購読を確認します。scope 変更・再導入は別の権限境界です。bot を未アーカイブの対象に招待します。

公開 callback でなく outbound Socket Mode を使います。app ID・bot ID・bot user ID は異なり account は bot user ID です。任意の `signing_secret` は公開 HTTP 署名受信機能を意味しません。DM/mention・同 thread の返信・選択・重複イベントの返信1回を確認します。`SLACK_IDENTITY_VERIFICATION_FAILED`、`missing_scope`、`not_in_channel` は解除後に身元/権限/参加を確認します。app scope は排他で他受信機と競合させません。[公式 Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)。

## 7. Discord の準備と確認

bot を guild に導入し、overwrite を含む View Channel・Send Messages（thread は Send Messages in Threads）、カード利用時の Embed Links 等を確認します。非公開 thread は bot の参加が必要で、アーカイブ/ロック済み thread は拒否されます。1対1には実 DM channel ID と installation `DM` を使い、group DM は対象外です。

公開 callback なしの Gateway を使用します。現在の Identify intents は `4609`（`GUILDS`、`GUILD_MESSAGES`、`DIRECT_MESSAGES`）で `MESSAGE_CONTENT` は要求しません。全一般メッセージ本文を読めると保証しません。実設定で mention/DM・カード選択を確認し権限を勝手に拡大しません。guild/channel/account 不一致・アクセス失敗・再接続/resume 時の重複返信なしを確認します。app scope は排他で修正前に解除します。[公式 Gateway/intents](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx)。

## 8. Telegram の準備と確認

bot token・数値 bot ID・対象 chat ID を確認します。installation/account は username でなく同じ数値 bot ID。private はユーザーが先に会話を開始し、group/supergroup では参加・送信・必要な写真権限を確認します。broadcast channel は対象外です。privacy 設定に応じた mention/コマンド/reply 受信を実確認します。

公開 callback なしの `getUpdates` long polling で、別 poller と同時実行しません。既存 webhook は `TELEGRAM_WEBHOOK_EXISTS` で遮断され、**自動削除しません**。先に既存サービス影響と切替承認を確認します。private/グループのボット宛質問・選択・返信・offset 復元・重複防止を確認します。解除は polling 停止のみで webhook 切替/backlog 削除を自動実行しません。[公式 Bot API](https://core.telegram.org/bots/api#getupdates)。

## 9. Google Chat の準備と確認

**Google Workspace add-on ではない HTTP Chat app** と **Project Number JWT** audience を使います。URL-audience ID token/add-on 形式は対象外です。callback は `/api/v1/channel-connections/google-chat/events`。数値 Project Number、文字列 project ID、bot `users/{bot-id}`、対象 `spaces/{space-id}` を区別します。

同プロジェクトの RSA service-account JSON（type、project_id、client_email、private_key_id、private_key、固定 Google token_uri）を用意します。任意 `project_id` は JSON と同値にします。Chat API・プロジェクト照会、OAuth scope `chat.bot` と `cloudplatformprojects.readonly`、project metadata 読取権限と space への app 追加を担当者が確認します。サービスアカウントメール/project ID を account に入れません。

プロジェクトの有効状態/番号・space 確認後も、最初の Google 署名対象イベントで有効化します。署名・issuer・正確な数値 audience、bot/space と返信 sender を検証します。DM/space mention・thread 返信・選択の実値・重複防止を確認します。`GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`、`GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`、`GOOGLE_CHAT_SENDER_VERIFICATION_FAILED` は無視せず解除して調査します。project scope の排他と既存 app 影響も確認します。[公式リクエスト検証](https://developers.google.com/workspace/chat/verify-requests-from-chat)。

## 10. LINE の準備と確認

Messaging API channel/Official Account の access token、channel secret と bot 情報の **bot user U-ID** を確認します。installation/account は両方その U-ID で、Console の**数値 channel ID ではありません**。target は user U-ID・group C-ID・room R-ID。友だち/参加・送信権限・グループ受信設定と既存自動返信の二重回答も確認します。

callback は `/api/v1/channel-connections/line/events`。プロキシは body を変えず、`X-Line-Signature` HMAC は **JSON 解析前の原文バイト**で検証します。bot API 身元だけで完了せず、最初の有効署名対象イベントが必要です。text・postback 選択・再配信の1回処理・不正署名で実行なしを確認します。

reply token は1回限り。実装は受信後**55秒未満**、再配信は元イベント後**20分未満**の保守的な窓です。公式期限を遅延保証と扱いません。期限切れ/結果不明を push や新 token で自動再試行しません。channel secret 再発行は旧署名を無効にするため影響確認・別承認が必要です。[公式署名検証](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [公式 reply 規則](https://developers.line.biz/en/reference/messaging-api/#send-reply-message)。

## 11. 状態とエラー

| 状態/code | 意味と対応 |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | 観測状態であり要求受付/検査結果とは別。connected も全送受信/受入れ完了ではありません。 |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | key/version/暗号文の復旧を担当者へ依頼。出力・任意交換禁止。 |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | 必須値/項目名/ID を確認。保存成功は provider 検証ではありません。 |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | 重複確認または先に解除。むやみに削除しません。 |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | worker/Node bridge を担当者が確認。迂回しません。 |
| `LEASE_EXPIRED`, scope/identity エラー | 一覧を開き直し code/時刻/秘匿済み証拠を報告。DB lease/fence を直接編集しません。 |
| 認証401/403、サイズ413、形式422、receiver disabled 503 | 認証/署名・原文・サイズ・サーバーを確認。HTTP 200 だけで返信成功としません。 |

安全な code/一般エラーだけ表示される場合があります。外部 API 原文は公開せず、自動更新を仮定せずパネルを開き直します。

## 12. 安全な停止・復旧と限界

解除で新しい作業を止め、必要なら担当者が worker を `false` に戻します。開始済みリモート HTTP の取消/回収は保証しません。`unknown` は結果不明で**自動再実行・再送・台帳削除禁止**です。パネルに unknown 再処理機能はありません。担当者が供給者記録と台帳を非公開で照合し別途判断を得ます。再接続で旧 unknown を再試行しません。

検証済み PR/commit の正常 revert 前に worker を停止します。migration downgrade は新テーブルが空の場合だけ可能です。接続/runtime データがある場合の拒否は正常で、強制削除/downgrade せず承認済み保全計画に従います。設定削除も全会話/delivery 消去ではありません。

master key/version の自動交換・再暗号化ツールはありません。暗号文は元キーと組織/接続/version AAD に結び付き、環境キーだけの変更は復号を壊します。provider credential 交換は承認後に解除→編集→検査→再接続し、初回身元イベントが再度必要な場合があります。メモリ credential/token cache の即時消去/寿命管理と cursor/receipt 長期増加/保全は改善境界です。解除/削除で全 cache/receipt 消去を保証しません。緊急失効には担当者のプロセス/供給者失効計画と承認が必要です。

## 13. 候補検証チェックリスト

| Provider | 開発証拠 | 実プラットフォーム |
|---|---|---|
| Teams | 実装・合成 JWT/native/packet 検証 | 未検証 |
| Slack | 実装・合成 Socket Mode/native 検証 | 未検証 |
| Discord | 実装・合成 Gateway/native 検証 | 未検証 |
| Telegram | 実装・合成 polling/native 検証 | 未検証 |
| Google Chat | 実装・合成 JWT/native/選択検証 | 未検証 |
| LINE | 実装・合成 HMAC/native/reply-token 検証 | 未検証 |

Tasks 1–11 の開発証拠の区分です。候補全体の API/Web、migration、Node22 image、skip、exact SHA は別の候補検証記録を確認します。実プラットフォーム PASS ではありません。

- 許可された試験者が各 provider で登録→検査→接続→実受信→CGA 実行→返信→選択→解除/再接続を実画面で確認します。
- 認証失敗、別 target/組織、重複/再配信、再起動、timeout/unknown で重複実行/送信がないことを確認します。commit/image・時刻・結果/未検証・rollback を記録し実 ID/Secret は除きます。
- 実 Secret 作成/登録、権限変更、外部呼出/費用、本番 DB、Oracle/本番配備は各々別途必要承認を得ます。有料 LLM ボットにはモデル/回数/予算/停止条件も必要です。本書は実行承認ではありません。

## 14. ソース対照

[画面](../../apps/web/components/channel-connections-panel.tsx)、[項目](../../apps/web/lib/channel-connections-api.ts)、[管理API](../../apps/api/app/api/routes/channel_connections.py)、[暗号化](../../apps/api/app/services/channel_connections.py)、[受信](../../apps/api/app/api/routes/channel_connection_events.py)、[supervisor](../../apps/api/app/services/channel_connection_supervisor.py)、[runtime](../../apps/api/app/services/channel_connection_runtime.py)、[Teams](../../apps/api/app/services/channel_connection_teams.py)、[Slack](../../apps/api/app/services/channel_connection_slack.py)、[Discord](../../apps/api/app/services/channel_connection_discord.py)、[Telegram](../../apps/api/app/services/channel_connection_telegram.py)、[Google Chat](../../apps/api/app/services/channel_connection_google_chat.py)、[Google認証](../../apps/api/app/services/channel_connection_google_chat_auth.py)、[LINE](../../apps/api/app/services/channel_connection_line.py)、[migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py)、[設定](../../apps/api/app/core/config.py)。
