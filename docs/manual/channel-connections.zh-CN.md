# 外部渠道连接操作指南

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. 范围与验证边界

本指南介绍 Teams、Slack、Discord、Telegram、Google Chat、LINE 的新连接面板，不替换原有 Webchat、Kakao、Teams 或机器人制作流程。内容依据源码和合成测试，是开发候选指南。真实平台设置界面、真实账户/凭据、外部收发、生产就绪和用户验收均**未验证**。以下平台准备是授权配置人员应核实的事项，不代表已经执行。

## 2. 前置条件

- 系统负责人确认准确的候选 commit/image、备份/恢复和批准范围；普通用户不要直接操作 DB/CLI。
- `CHANNEL_CONNECTION_WORKER_ENABLED=false` 为默认值。保存/检查不访问外部；实际连接及启用 worker 需要单独批准。
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` 必须是 Base64 编码的 **32 字节**密钥；`CHANNEL_CONNECTION_KEY_VERSION` 默认为 `v1`。不得在截图、Git、日志中记录值。缺失/损坏的密钥或 AAD 不匹配会关闭外部连接。
- API packet bridge 需要 **Node 22**、共享转换文件及可执行的 `CHANNEL_CONNECTION_NODE_BINARY`。其他本地 Node 版本的测试不能代替 Node22 image 验证。
- 负责人在批准的目标验证 additive migration：`20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030`。仅新增连接、lease、房间映射、delivery 表，不迁移原记录。生产 DB 应用另行批准。
- 组织、组、回答机器人、父渠道必须启用，机器人有可运行版本；需要组织管理员及平台应用管理权限。

## 3. 页面注册、连接和断开

1. 管理员打开 `Admin > 渠道管理`，确认已有渠道类型及启用状态，点击支持类型行的 `连接目标`。
2. 选择 `添加连接`，填写名称、回答机器人、安装/工作区 ID、外部机器人账户 ID、房间/频道 ID。参照第4节；显示名称/邀请链接不是 ID。
3. 只填写页面显示的凭据字段并保存。首次必须有凭据；编辑时空白保留旧值，非空字段合并。不要将“已登记”、星号或掩码作为 Secret。保存后不回显 Secret。
4. `检查设置` 后检查时间和错误。这里只验证格式、必填项、启用状态，不验证外部身份/权限；“设置有效 · 外部接入未验证”不代表连接成功。
5. 获得实际通信批准并准备服务器后点击 `连接`。先进入 `连接中`，worker 再验证身份、目标及独占 scope。Teams/Google Chat/LINE 还需要首个认证目标事件。只发送一次批准的测试问题，重新打开面板核实状态与实际回复；首个问题也被保留处理。
6. 编辑/删除前先 `断开连接` 并确认 `未连接`。错误但仍有连接请求时也须断开。删除是设置软删除，对话保留；有连接行的父渠道不能随意改 provider 或删除。

## 4. ID 与凭据字段

| 类型 | installation_id | account_id | target_id | 必填凭据 / 可选 |
|---|---|---|---|---|
| Teams (`ms_teams`) | tenant UUID | app client UUID | Teams channel ID，否则 conversation ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | workspace/team ID | bot **user** ID | 可访问 conversation ID | `bot_token`, `app_token` / 可选 `signing_secret` |
| Discord (`discord`) | guild ID，一对一为 `DM` | bot user ID | channel/thread/DM ID | `bot_token` |
| Telegram (`telegram`) | bot 数字 user ID | 相同 bot 数字 user ID | private/group/supergroup chat ID | `bot_token` |
| Google Chat (`google_chat`) | 数字 **Project Number** | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / 可选且匹配的 `project_id` |
| LINE (`line`) | bot user ID：`U`+32位小写hex | 相同 bot user ID | user `U…` / group `C…` / room `R…` | `access_token`, `channel_secret` |

外部 ID 也是敏感运维信息，不得在公开文档、错误、日志、PR 复制真实值。花括号是说明用占位符，不能直接保存。其他凭据字段会被拒绝。

## 5. Teams 准备与检查

授权人员核实 Bot Connector 的 tenant/client/secret、Teams channel 启用及目标中的应用安装；tenant/client 必须与表中一致。批准的 HTTPS callback 路径为 `/api/v1/channel-connections/ms-teams/events`（`https://example.com/api/v1/channel-connections/ms-teams/events` 只是保留域名示例）。

OAuth token 获取成功不等于已连接。必须匹配 Microsoft JWT 签名、issuer、audience、tenant/app、认证 service URL 和目标 activity。连接后发送首个面向机器人的认证 activity，确认首问保留、一次 CGA 回复及正确会话。错误认证/tenant/target 应不执行机器人。失败时断开、检查安装/ID/endpoint，再用新问题验证。[官方 Teams 文档](https://learn.microsoft.com/en-us/microsoftteams/platform/)。

## 6. Slack 准备与检查

准备同一 app/workspace 的 bot token 与**独立的 app-level token**。app token 需 `connections:write`；启用 Socket Mode、所需事件/interaction。核实 bot 的 `chat:write`、`bots:read`、相应 conversation 查询权限（`channels:read`、`groups:read`、`im:read` 等）和 mention/message 订阅。scope 更改/重新安装另行授权；邀请 bot 进入非归档目标。

使用 outbound Socket Mode，不用公共 callback。app ID、bot ID、bot user ID 不同；account 填 bot user ID。`signing_secret` 可选，不表示新增公共 HTTP 签名接收器。验证 DM/mention、同 thread 回复、选择及重复事件不重发。`SLACK_IDENTITY_VERIFICATION_FAILED`、`missing_scope`、`not_in_channel` 时断开并核实身份/权限/成员关系；app scope 为独占，不并行运行其他接收器。[官方 Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)。

## 7. Discord 准备与检查

将 bot 安装到 guild，核实有效 overwrite：View Channel、Send Messages（thread 为 Send Messages in Threads），卡片需要时核实 Embed Links。私有 thread 需 bot 成员资格，归档/锁定 thread 被拒绝。一对一用实际 DM channel ID 和 installation `DM`；不支持 group DM。

使用 Gateway，无公共 callback；当前 Identify intents 是 `4609`（`GUILDS`、`GUILD_MESSAGES`、`DIRECT_MESSAGES`），未请求 `MESSAGE_CONTENT`，不能保证接收所有普通消息内容。核实实际 mention/DM、卡片选择及 app 设置，不擅自扩大权限。检查 guild/channel/account 不匹配、访问失败和重连/resume 后无重复回复。app scope 独占；修正前断开。[官方 Gateway/intents](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx)。

## 8. Telegram 准备与检查

核实 bot token、bot 数字 ID、目标 chat ID；installation/account 均为数字 bot ID，不是 username。private 由用户先启动对话；group/supergroup 需 bot 成员及发送/必要照片权限。不支持广播 channel。依据 privacy 设置实际确认 mention/命令/reply 接收。

使用 `getUpdates` long polling，无公共 callback，不与其他 poller 并行。有 webhook 会报 `TELEGRAM_WEBHOOK_EXISTS`，**不会自动删除**；先确认既有服务影响和切换批准。检查 private 或面向 bot 的群问题、选择、回答、offset 恢复和去重。断开仅停止 polling，不自动切换 webhook/删除 backlog。[官方 Bot API](https://core.telegram.org/bots/api#getupdates)。

## 9. Google Chat 准备与检查

必须是**非 Google Workspace add-on 的 HTTP Chat app**，认证 audience 使用 **Project Number JWT**，不支持 URL-audience ID token/add-on 格式。callback 为 `/api/v1/channel-connections/google-chat/events`。数字 Project Number、字符串 project ID、bot `users/{bot-id}`、目标 `spaces/{space-id}` 不能混用。

准备同项目的 RSA service-account JSON（type、project_id、client_email、private_key_id、private_key、固定 Google token_uri）。可选 `project_id` 要与 JSON 相同。配置人员核实 Chat API、项目查询、OAuth scope `chat.bot` 和 `cloudplatformprojects.readonly`、项目 metadata 读取权限，以及 app 已加入 space；不要把服务账户邮箱/project ID 填入 account。

项目活跃状态/编号和 space 检查后，仍需首个 Google 签名目标事件激活。签名、issuer、精确数字 audience、bot/space 及回复 sender 均须匹配。验证 DM/space mention、thread 回复、卡片实际选择值、去重。出现 `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`、`GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`、`GOOGLE_CHAT_SENDER_VERIFICATION_FAILED` 时断开调查，不忽略错误。检查项目 scope 独占及既有应用影响。[官方请求验证](https://developers.google.com/workspace/chat/verify-requests-from-chat)。

## 10. LINE 准备与检查

准备 Messaging API channel/Official Account 的 access token、channel secret，以及 bot 信息中的 **bot user U-ID**。installation/account 都是这个 U-ID，**不是控制台的数字 channel ID**。target 为用户 U-ID、群 C-ID 或 room R-ID；核实好友/群成员、发送权限、群接收设置及既有自动回复可能造成的双重回答。

callback 为 `/api/v1/channel-connections/line/events`。代理不能改变 body；`X-Line-Signature` HMAC 在 **JSON 解析前按原始字节**验证。bot API 身份成功仍需首个有效签名目标事件。检查文本、postback 选择、重复投递仅处理一次，以及无效签名不执行。

reply token 单次使用；实现采用接收后**不足55秒**，重投递还须原事件后**不足20分钟**的保守窗口。官方时间不是延迟保证。过期/不确定发送不能自动改 push/新 token 重试。重发 channel secret 会使既有签名失效，需先审查影响并单独批准。[官方签名验证](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [官方 reply 规则](https://developers.line.biz/en/reference/messaging-api/#send-reply-message)。

## 11. 状态与错误

| 状态/code | 含义与操作 |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | 观测状态，不是请求/检查结果；connected 也不等于完整收发或验收。 |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | 请负责人恢复 key/version/密文，不打印或随意替换。 |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | 核实必填项/字段名/ID；保存不代表 provider 验证。 |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | 检查重复或先断开，不盲目删除。 |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | 负责人核实 worker/Node bridge，不能绕过。 |
| `LEASE_EXPIRED`, scope/identity 错误 | 重开列表，报告 code/时间/脱敏证据，不直接改 DB lease/fence。 |
| 401/403、413、422、receiver disabled 503 | 分别核实认证/签名、大小、格式、服务器；HTTP 200 不证明已回复。 |

页面可能仅显示安全 code/通用错误；不公开外部 API 原文。不假定自动刷新，应重开面板。

## 12. 安全停止、恢复及限制

先断开停止新工作，必要时负责人把 worker 设为 `false`。不能保证撤回已开始的远端 HTTP。`unknown` 表示发送结果不确定，**不得自动执行/重发/删除原账**；面板无 unknown 重处理功能。负责人私下核对 provider 记录及内部原账后另行决策；重连不授权重试旧 unknown。

恢复代码前先停 worker，再正常 revert 已验证 PR/commit。仅新表为空时可 downgrade；存在连接/runtime 数据时拒绝是正常行为，不强制删除/downgrade，遵循批准的备份/保留计划。删除设置不等于删除所有对话/delivery。

没有自动 master key/version 轮换或重加密工具。密文绑定原密钥及组织/连接/version AAD，仅改环境 key 会导致解密失败。provider 凭据轮换须批准后按断开→编辑→检查→重连执行，可能需新的首个身份事件。内存 credential/token cache 即时清除、cache 生命周期，以及 cursor/receipt 长期增长/保留仍有限制；断开/删除不保证全部清除。紧急撤销需负责人制定进程/供应者撤销方案并获批。

## 13. 候选验证清单

| Provider | 开发证据 | 真实平台 |
|---|---|---|
| Teams | 已实现；合成 JWT/native/packet 验证 | 未验证 |
| Slack | 已实现；合成 Socket Mode/native 验证 | 未验证 |
| Discord | 已实现；合成 Gateway/native 验证 | 未验证 |
| Telegram | 已实现；合成 polling/native 验证 | 未验证 |
| Google Chat | 已实现；合成 JWT/native/选择验证 | 未验证 |
| LINE | 已实现；合成 HMAC/native/reply-token 验证 | 未验证 |

这里只区分 Tasks 1–11 开发证据。候选的完整 API/Web、migration、Node22 image、skip、exact SHA 另查该候选验证记录，不是实际平台 PASS。

- 授权测试者逐 provider 在实际页面执行注册→检查→连接→真实接收→CGA 执行→回复→选择→断开/重连。
- 确认认证失败、错误 target/组织、重复/重投递、重启、timeout/unknown 均不重复执行/发送。只记录 commit/image、时间、结果/未验证、rollback，不记录真实 ID/Secret。
- 真实 Secret 创建/登记、权限修改、外部调用/费用、生产 DB、Oracle/生产部署分别需要适用的单独批准。付费 LLM 回答机器人还需模型/次数/预算/停止条件批准。本指南不是执行许可。

## 14. 源码对照

[页面](../../apps/web/components/channel-connections-panel.tsx)、[字段](../../apps/web/lib/channel-connections-api.ts)、[管理API](../../apps/api/app/api/routes/channel_connections.py)、[加密](../../apps/api/app/services/channel_connections.py)、[接收](../../apps/api/app/api/routes/channel_connection_events.py)、[supervisor](../../apps/api/app/services/channel_connection_supervisor.py)、[runtime](../../apps/api/app/services/channel_connection_runtime.py)、[Teams](../../apps/api/app/services/channel_connection_teams.py)、[Slack](../../apps/api/app/services/channel_connection_slack.py)、[Discord](../../apps/api/app/services/channel_connection_discord.py)、[Telegram](../../apps/api/app/services/channel_connection_telegram.py)、[Google Chat](../../apps/api/app/services/channel_connection_google_chat.py)、[Google认证](../../apps/api/app/services/channel_connection_google_chat_auth.py)、[LINE](../../apps/api/app/services/channel_connection_line.py)、[migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py)、[设置](../../apps/api/app/core/config.py)。
