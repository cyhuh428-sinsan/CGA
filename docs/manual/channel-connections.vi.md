# Hướng dẫn vận hành kết nối kênh bên ngoài

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. Phạm vi và ranh giới xác minh

Hướng dẫn bảng kết nối mới cho Teams, Slack, Discord, Telegram, Google Chat, LINE; không thay thế Webchat, Kakao, Teams hoặc quy trình tạo bot hiện có. Đây là hướng dẫn bản ứng viên phát triển dựa trên mã nguồn và kiểm thử tổng hợp. Màn hình cấu hình nền tảng thật, tài khoản/Secret thật, gửi nhận bên ngoài, khả năng vận hành và nghiệm thu người dùng đều **chưa xác minh**. Chuẩn bị dưới đây là việc người có thẩm quyền cần kiểm tra, không phải biên bản đã thực hiện.

## 2. Điều kiện trước khi chạy

- Người vận hành xác nhận commit/image chính xác, sao lưu/khôi phục và phạm vi được duyệt. Người dùng không tự thao tác DB/CLI.
- Mặc định `CHANNEL_CONNECTION_WORKER_ENABLED=false`. Lưu/kiểm tra không gọi dịch vụ ngoài. Chỉ bật worker và kết nối thật sau phê duyệt riêng.
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` phải mã hóa **32 byte** bằng Base64; `CHANNEL_CONNECTION_KEY_VERSION` mặc định `v1`. Không ghi giá trị vào ảnh chụp, Git, log. Thiếu/hỏng khóa hoặc sai AAD thì chặn kết nối ngoài.
- API packet bridge cần **Node 22**, tài nguyên chuyển đổi dùng chung và `CHANNEL_CONNECTION_NODE_BINARY` chạy được. Kiểm thử Node cục bộ khác không chứng minh image Node22.
- Người phụ trách kiểm tra chuỗi migration bổ sung `20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030` trên đích được duyệt. Chỉ thêm bảng connection, lease, ánh xạ phòng, delivery; không di chuyển bản ghi cũ. DB production cần duyệt riêng.
- Tổ chức, nhóm, bot trả lời, kênh cha phải hoạt động; bot có phiên bản chạy được. Cần quyền quản trị tổ chức và quản lý ứng dụng nền tảng.

## 3. Đăng ký, kết nối và ngắt trên giao diện

1. Đăng nhập quản trị, mở `Admin > Quản lý kênh`, kiểm tra loại kênh hiện có và trạng thái hoạt động, mở `Kết nối` của dòng hỗ trợ.
2. Chọn `Thêm kết nối`: tên, bot trả lời, ID cài đặt/không gian làm việc, tài khoản bot ngoài, phòng/kênh theo mục 4. Không dùng tên hiển thị hoặc URL mời thay ID.
3. Chỉ nhập trường xác thực hiển thị rồi lưu. Lần đầu cần thông tin xác thực. Khi sửa, để trống giữ giá trị cũ; trường không trống được hợp nhất. Không dán “Đã đăng ký”, dấu sao hoặc mặt nạ như Secret. Secret đã lưu không được hiển thị lại.
4. `Kiểm tra cài đặt`, xem thời gian và lỗi. Chỉ kiểm tra định dạng, trường bắt buộc, tài nguyên hoạt động; không xác minh danh tính/quyền bên ngoài. “Cài đặt hợp lệ · chưa xác minh truy cập thực tế” không phải kết nối thành công.
5. Sau duyệt liên lạc thật và chuẩn bị máy chủ, bấm `Kết nối`. Ban đầu là `Đang kết nối`; worker xác minh danh tính, đích và scope độc quyền. Teams/Google Chat/LINE còn cần sự kiện đích đã xác thực đầu tiên. Gửi một câu hỏi thử được duyệt, mở lại bảng để đối chiếu trạng thái và câu trả lời thật. Câu hỏi đầu được giữ để xử lý.
6. Trước sửa/xóa, `Ngắt kết nối` và xác nhận `Chưa kết nối`. Dòng lỗi vẫn có yêu cầu kết nối cũng phải ngắt. Xóa là soft-delete cài đặt, giữ lịch sử hội thoại. Kênh cha có dòng kết nối bị hạn chế đổi provider/xóa.

## 4. ID và trường xác thực

| Loại | installation_id | account_id | target_id | Bắt buộc / tùy chọn |
|---|---|---|---|---|
| Teams (`ms_teams`) | tenant UUID | app client UUID | Teams channel ID, nếu không có thì conversation ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | workspace/team ID | bot **user** ID | conversation ID truy cập được | `bot_token`, `app_token` / tùy chọn `signing_secret` |
| Discord (`discord`) | guild ID hoặc `DM` cho 1:1 | bot user ID | channel/thread/DM ID | `bot_token` |
| Telegram (`telegram`) | bot user ID dạng số | cùng bot user ID dạng số | private/group/supergroup chat ID | `bot_token` |
| Google Chat (`google_chat`) | **Project Number** dạng số | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / tùy chọn `project_id` khớp |
| LINE (`line`) | bot user ID `U`+32 ký tự hex thường | cùng bot user ID | user `U…` / group `C…` / room `R…` | `access_token`, `channel_secret` |

ID ngoài cũng là dữ liệu vận hành nhạy cảm; không sao chép ID thật vào tài liệu công khai, lỗi, log, PR. Dấu ngoặc nhọn là chỗ giữ chỗ giải thích, không lưu nguyên văn. Trường xác thực ngoài danh sách bị từ chối.

## 5. Chuẩn bị và kiểm tra Teams

Người có quyền kiểm tra tenant/client/secret phù hợp Bot Connector, bật Teams channel và cài app ở đích. tenant/client xác thực phải khớp bảng. Đường callback HTTPS được duyệt: `/api/v1/channel-connections/ms-teams/events`; `https://example.com/api/v1/channel-connections/ms-teams/events` chỉ là ví dụ, không phải địa chỉ thật.

Có OAuth token chưa có nghĩa đã kết nối. Cần khớp chữ ký Microsoft JWT, issuer, audience, tenant/app, service URL đã xác thực và activity đích. Gửi activity đầu gọi bot, xác nhận giữ câu hỏi đầu, đúng hội thoại và chỉ một câu trả lời CGA. Sai xác thực/tenant/target không được thực thi. Khi lỗi, ngắt, kiểm tra cài đặt/ID/endpoint rồi thử bằng câu hỏi mới. [Tài liệu Teams chính thức](https://learn.microsoft.com/en-us/microsoftteams/platform/).

## 6. Chuẩn bị và kiểm tra Slack

Chuẩn bị bot token và **app-level token riêng** từ cùng app/workspace. App token cần `connections:write`; bật Socket Mode và sự kiện/interaction cần thiết. Kiểm tra `chat:write`, `bots:read`, quyền đọc conversation phù hợp (`channels:read`, `groups:read`, `im:read`...), đăng ký mention/message. Đổi scope/cài lại cần quyền riêng; mời bot vào đích chưa lưu trữ.

Dùng outbound Socket Mode, không có public callback. App ID, bot ID, bot user ID khác nhau; account dùng bot user ID. `signing_secret` là tùy chọn, không phải tính năng nhận HTTP có chữ ký công khai. Kiểm tra DM/mention, trả lời đúng thread, lựa chọn và không lặp trả lời cùng sự kiện. Với `SLACK_IDENTITY_VERIFICATION_FAILED`, `missing_scope`, `not_in_channel`, ngắt rồi kiểm tra danh tính/quyền/thành viên. Scope app độc quyền, không chạy bộ nhận cạnh tranh. [Socket Mode chính thức](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## 7. Chuẩn bị và kiểm tra Discord

Cài bot vào guild; kiểm tra quyền hiệu lực kể cả overwrite: View Channel, Send Messages (thread: Send Messages in Threads), Embed Links khi dùng thẻ. Thread riêng cần bot tham gia; thread lưu trữ/khóa bị từ chối. 1:1 dùng DM channel ID thật và installation `DM`; không hỗ trợ group DM.

Dùng Gateway, không public callback. Identify intents hiện tại là `4609` (`GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`), không yêu cầu `MESSAGE_CONTENT`; không đảm bảo đọc mọi tin nhắn thường. Xác minh mention/DM, chọn thẻ với cấu hình app thật, không tự mở rộng quyền. Kiểm tra sai guild/channel/account, mất quyền và reconnect/resume không trả lời lặp. Scope app độc quyền; ngắt trước sửa. [Gateway/intents chính thức](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx).

## 8. Chuẩn bị và kiểm tra Telegram

Xác nhận bot token, bot ID số và chat ID. Installation/account đều là cùng bot ID số, không phải username. Private cần người dùng bắt đầu chat; group/supergroup cần bot tham gia, quyền gửi và ảnh nếu dùng. Không hỗ trợ broadcast channel. Kiểm tra mention/lệnh/reply nhận được theo privacy thực tế.

Dùng `getUpdates` long polling, không callback; không chạy poller khác đồng thời. Webhook có sẵn chặn với `TELEGRAM_WEBHOOK_EXISTS`, **không tự xóa**. Trước tiên kiểm tra ảnh hưởng dịch vụ cũ và duyệt chuyển đổi. Thử câu hỏi private/nhóm hướng tới bot, lựa chọn, trả lời, khôi phục offset và chống lặp. Ngắt chỉ dừng polling, không tự chuyển webhook hay xóa backlog. [Bot API chính thức](https://core.telegram.org/bots/api#getupdates).

## 9. Chuẩn bị và kiểm tra Google Chat

Dùng **HTTP Chat app không phải Google Workspace add-on**, audience **Project Number JWT**. Không hỗ trợ URL-audience ID token/payload add-on. Callback: `/api/v1/channel-connections/google-chat/events`. Phân biệt Project Number số, project ID chuỗi, bot `users/{bot-id}`, space `spaces/{space-id}`.

Chuẩn bị RSA service-account JSON cùng dự án (type, project_id, client_email, private_key_id, private_key, Google token_uri cố định). `project_id` tùy chọn phải khớp JSON. Người cấu hình kiểm tra Chat API, truy vấn dự án, OAuth scope `chat.bot`, `cloudplatformprojects.readonly`, quyền đọc metadata dự án và app đã vào space. Không nhập email service account/project ID làm account.

Sau kiểm tra dự án active/number và space, vẫn cần sự kiện đích có chữ ký Google đầu tiên. Cần chữ ký, issuer, audience số chính xác, bot/space và sender trả lời khớp. Thử DM/space mention, trả lời thread, giá trị lựa chọn thẻ thật, chống lặp. Không bỏ qua `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`, `GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`, `GOOGLE_CHAT_SENDER_VERIFICATION_FAILED`; ngắt và điều tra. Kiểm tra scope dự án độc quyền và ảnh hưởng app cũ. [Xác minh chính thức](https://developers.google.com/workspace/chat/verify-requests-from-chat).

## 10. Chuẩn bị và kiểm tra LINE

Chuẩn bị access token, channel secret của Messaging API channel/Official Account và **bot user U-ID** từ thông tin bot. Installation/account đều dùng U-ID đó, **không phải numeric channel ID** trong console. Target là user U-ID, group C-ID, room R-ID; kiểm tra kết bạn/thành viên, quyền gửi, nhận nhóm và trả lời tự động cũ có thể gây trả lời kép.

Callback: `/api/v1/channel-connections/line/events`. Proxy không được đổi body; xác minh HMAC `X-Line-Signature` trên **byte nguyên gốc trước JSON parsing**. Danh tính bot API chưa đủ, cần sự kiện đích có chữ ký hợp lệ đầu tiên. Thử text, postback, redelivery chỉ xử lý một lần, chữ ký sai không thực thi.

Reply token chỉ dùng một lần. Triển khai áp dụng cửa sổ thận trọng **dưới 55 giây** sau nhận, redelivery thêm **dưới 20 phút** từ sự kiện gốc. Thời hạn chính thức không bảo đảm chịu trễ. Không tự thử lại gửi hết hạn/không rõ bằng push/token mới. Cấp lại channel secret làm vô hiệu chữ ký cũ, cần đánh giá ảnh hưởng và duyệt riêng. [Chữ ký chính thức](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [Quy tắc reply](https://developers.line.biz/en/reference/messaging-api/#send-reply-message).

## 11. Trạng thái và lỗi

| Trạng thái/code | Ý nghĩa và xử lý |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | Trạng thái quan sát, không phải nhận yêu cầu/kiểm tra thành công. Connected chưa chứng minh roundtrip/nghiệm thu. |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | Nhờ người phụ trách khôi phục key/version/bản mã, không in hoặc tự đổi. |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | Kiểm tra trường bắt buộc/tên/ID. Lưu chưa chứng minh xác minh provider. |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | Kiểm tra trùng hoặc ngắt trước; không xóa tùy tiện. |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | Người phụ trách kiểm tra worker/Node bridge; không vượt gate. |
| `LEASE_EXPIRED`, lỗi scope/identity | Mở lại danh sách; báo code/thời gian/bằng chứng che nhạy cảm; không sửa lease/fence trong DB. |
| 401/403, 413, 422, receiver disabled 503 | Kiểm tra xác thực/chữ ký/body, kích thước, định dạng, máy chủ; HTTP 200 không chứng minh có trả lời. |

Giao diện có thể chỉ hiển thị code an toàn/lỗi chung. Không công khai lỗi API ngoài nguyên văn. Mở lại bảng, không giả định tự làm mới.

## 12. Dừng an toàn, khôi phục và giới hạn

Ngắt để dừng việc mới; người vận hành có thể đặt worker `false`. Không bảo đảm thu hồi HTTP ngoài đã bắt đầu. `unknown` là không rõ kết quả: **không tự thực thi/gửi lại/xóa sổ**. Bảng không có công cụ xử lý lại unknown. Người phụ trách đối chiếu riêng bản ghi provider và sổ nội bộ, xin quyết định riêng; reconnect không cho phép thử lại unknown cũ.

Tắt worker trước khi revert bình thường PR/commit đã kiểm chứng. Chỉ downgrade migration khi bảng mới rỗng. Có dữ liệu connection/runtime thì từ chối là đúng; không ép downgrade/xóa, tuân theo kế hoạch sao lưu/bảo tồn được duyệt. Xóa cài đặt không xóa hết hội thoại/delivery.

Không có công cụ tự xoay master key/version hay mã hóa lại. Bản mã gắn với khóa cũ và AAD tổ chức/connection/version; chỉ đổi key môi trường làm hỏng giải mã. Đổi credential provider cần duyệt rồi ngắt→sửa→kiểm tra→kết nối lại, có thể cần sự kiện danh tính đầu mới. Xóa ngay credential/token cache bộ nhớ, vòng đời cache và tăng trưởng/giữ cursor/receipt dài hạn vẫn là giới hạn. Ngắt/xóa không bảo đảm xóa mọi cache/receipt. Thu hồi khẩn cần kế hoạch tiến trình/thu hồi provider và duyệt riêng.

## 13. Danh sách xác minh ứng viên

| Provider | Bằng chứng phát triển | Nền tảng thật |
|---|---|---|
| Teams | Đã triển khai; kiểm thử tổng hợp JWT/native/packet | Chưa xác minh |
| Slack | Đã triển khai; tổng hợp Socket Mode/native | Chưa xác minh |
| Discord | Đã triển khai; tổng hợp Gateway/native | Chưa xác minh |
| Telegram | Đã triển khai; tổng hợp polling/native | Chưa xác minh |
| Google Chat | Đã triển khai; tổng hợp JWT/native/lựa chọn | Chưa xác minh |
| LINE | Đã triển khai; tổng hợp HMAC/native/reply-token | Chưa xác minh |

Bảng chỉ phân biệt bằng chứng Tasks 1–11. Xem biên bản ứng viên riêng để biết toàn API/Web, migration, image Node22, skip và exact SHA; không phải PASS nền tảng thật.

- Người thử được phép thực hiện đăng ký→kiểm tra→kết nối→nhận thật→chạy CGA→trả lời→chọn→ngắt/kết nối lại cho từng provider trên giao diện thật.
- Kiểm tra sai xác thực/target/tổ chức, lặp/redelivery, restart, timeout/unknown không chạy/gửi trùng. Ghi commit/image, thời gian, kết quả/chưa xác minh, rollback; không ghi ID/Secret thật.
- Tạo/đăng ký Secret thật, đổi quyền, gọi ngoài/chi phí, DB production, triển khai Oracle/production cần phê duyệt riêng thích hợp. Bot LLM tính phí còn cần duyệt model/số lần/ngân sách/điều kiện dừng. Tài liệu không phải lệnh thực thi.

## 14. Đối chiếu mã nguồn

[Giao diện](../../apps/web/components/channel-connections-panel.tsx), [trường](../../apps/web/lib/channel-connections-api.ts), [API quản trị](../../apps/api/app/api/routes/channel_connections.py), [mã hóa](../../apps/api/app/services/channel_connections.py), [nhận](../../apps/api/app/api/routes/channel_connection_events.py), [supervisor](../../apps/api/app/services/channel_connection_supervisor.py), [runtime](../../apps/api/app/services/channel_connection_runtime.py), [Teams](../../apps/api/app/services/channel_connection_teams.py), [Slack](../../apps/api/app/services/channel_connection_slack.py), [Discord](../../apps/api/app/services/channel_connection_discord.py), [Telegram](../../apps/api/app/services/channel_connection_telegram.py), [Google Chat](../../apps/api/app/services/channel_connection_google_chat.py), [Google auth](../../apps/api/app/services/channel_connection_google_chat_auth.py), [LINE](../../apps/api/app/services/channel_connection_line.py), [migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py), [cấu hình](../../apps/api/app/core/config.py).
