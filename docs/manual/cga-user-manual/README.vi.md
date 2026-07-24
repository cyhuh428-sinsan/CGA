# Hướng dẫn sử dụng CGA Studio

Đối tượng: Người dùng phổ thông, người vận hành bot, quản trị viên hệ thống

Tài liệu này mô tả các menu và quy trình làm việc của CGA Studio. Nếu bạn sử dụng lần đầu tiên, hãy đọc [Bắt đầu CGA](../cga-getting-started/README.md) trước và tham khảo [Hướng dẫn sử dụng CGA NLU](../cga-nlu-guide/README.md) để lựa chọn, tìm hiểu và cải thiện chất lượng công cụ.


## 1. Khởi động CGA Studio

### 1.1 Đăng nhập

1. Mở màn hình đăng nhập CGA Studio.
2. Nhập thông tin tài khoản của bạn.
3. Sau khi đăng nhập, hãy chuyển đến màn hình CGA Studio.


### 1.2 Các ký hiệu sử dụng trong tài liệu

- `Bot`: Đơn vị cung cấp dịch vụ hội thoại
- `Phiên bản`: Đơn vị thực thi quản lý cấu hình và tài sản đào tạo của bot.
- `Phương thức NLU`: Một phương pháp diễn giải lời nói của người dùng theo mục đích hoặc ý nghĩa
- `Phương thức trả lời`: Phương pháp tạo hoặc truy xuất câu trả lời dựa trên kết quả phân loại
- `Huấn luyện`: Phản ánh dữ liệu từ bot cho ML hoặc công cụ thực thi đã chọn

### 1.3 Kiểm tra trạng thái trên màn hình

Màn hình tạo bot hiển thị khu vực nhập liệu cũng như khu vực tóm tắt lựa chọn hiện tại. Trước tiên hãy kiểm tra các mục sau:

- Ngôn ngữ
- Phương pháp NLU
- Mô hình NLU
- Phương thức phản hồi
- Nhà cung cấp hoặc mô hình LLM
Phiên bản - phiên bản

Nếu bạn thay đổi phương pháp NLU hoặc phương pháp trả lời, các kiểu máy có thể chọn và các mục cài đặt bổ sung có thể thay đổi. Kiểm tra xem trạng thái kết hợp của màn hình là `Sẵn sàng chạy/huấn luyện` hay `Chỉ có thể lưu cài đặt` rồi quyết định hành động tiếp theo. Nếu bạn đang sử dụng lần đầu tiên, đừng chọn `Xác nhận` mà không kiểm tra trạng thái kết hợp.

Trong màn hình tạo, `Xác nhận` là hành động gửi cài đặt đã nhập và `Hủy` là hành động thoát khỏi màn hình tạo. Sau khi gửi, kết quả tạo bot và trạng thái hoàn thành tìm hiểu/lập chỉ mục phải được xác minh thực thi riêng biệt.

## 2. Tạo bot và cài đặt AI

Trên màn hình tạo bot, chỉ định thông tin cơ bản của bot và các cài đặt liên quan đến AI.

### 2.1 Thông tin cơ bản

Các mục mặc định nhìn thấy trên màn hình hiện tại như sau:

- Loại Bot: Bot, Bot Hub
- Chế độ bot: loại văn bản, loại giọng nói
- Hồ sơ bot
- Tên máy
- Ngôn ngữ: Tùy chọn màn hình hiện tại là tiếng Hàn
- Giới thiệu

Nhập tên bot theo hướng dẫn trên màn hình, quan sát các ký tự và độ dài được phép. Ảnh hồ sơ sẽ có định dạng PNG, JPEG, WEBP và giới hạn kích thước hiển thị trên màn hình.

### 2.2 Phương pháp NLU

Các phương pháp NLU hiện có sẵn để lựa chọn trên màn hình CGA như sau.

| màn hình hiển thị | Ý nghĩa |
|---|---|
| ML | Phương pháp phân loại dựa trên câu và ý định học |
| Ngữ nghĩa - Công nhân Vector | Phương pháp ngữ nghĩa sử dụng Vector Worker và Vector DB của CGA |
| Ngữ nghĩa - Nhúng bên ngoài | Phương thức ngữ nghĩa kết nối nhúng bên ngoài và DB Vector cục bộ |
| Động cơ LLM | Cách sử dụng mô hình LLM |

Để biết các tiêu chí lựa chọn dành riêng cho động cơ và phương pháp chuẩn bị dữ liệu, hãy tham khảo [So sánh động cơ trong Hướng dẫn sử dụng NLU](../cga-nlu-guide/engine-comparison.md).

### Mô hình 2.3 NLU

Danh sách model thay đổi tùy theo phương pháp NLU.

- ML: DeepLearning Lite, TF-IDF Linear, Đường cơ sở từ khóa
- Ngữ nghĩa: Mô hình Vector Worker mặc định hoặc mô hình nhúng bên ngoài
- LLM: Lựa chọn nhà cung cấp và lựa chọn mô hình chi tiết cho từng nhà cung cấp

Trên màn hình LLM, các nhà cung cấp như Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama và OpenRouter có thể được hiển thị và danh sách mô hình chi tiết khác nhau tùy thuộc vào nhà cung cấp đã chọn. Các mẫu máy hiện có và trạng thái kết nối thực tế được kiểm tra dựa trên trạng thái có thể chọn trên màn hình tạo.

### 2.4 Phương thức phản hồi

Các phương pháp trả lời hiển thị trên màn hình hiện tại như sau.

- Câu trả lời được xác định
- Câu trả lời RAG của Công cụ Ngữ nghĩa
- Câu trả lời về LLM Engine RAG
- Câu trả lời về động cơ LLM

Sự kết hợp giữa phương pháp NLU và phương pháp trả lời có thể hiển thị trạng thái hỗ trợ. Nếu trạng thái kết hợp hiển thị là không khả dụng, đừng tiếp tục; thay đổi thành một sự kết hợp được hỗ trợ.

## 3. Phiên bản bot và không gian làm việc

Sau khi tạo bot, hãy quản lý bot và phiên bản riêng biệt.

- Bot: Thông tin cơ bản và mục tiêu hoạt động của đơn vị dịch vụ
- Phiên bản: Đơn vị quản lý ý định, đối tượng, từ điển, thiết kế hội thoại và cài đặt AI.
- Workspace: Màn hình thiết kế, thử nghiệm và phân tích một phiên bản bot cụ thể.

Đường dẫn chi tiết được kiểm tra dựa trên tên menu của màn hình CGA hiện tại.

Khi bắt đầu thao tác, trước tiên hãy chọn bot và phiên bản, đồng thời đảm bảo rằng những gì hiển thị trên màn hình là những gì bạn dự định. Nếu bạn chỉnh sửa dữ liệu của mình bằng một bot hoặc phiên bản khác đã chọn, kết quả của bạn có thể thay đổi.

### 3.1 Đường dẫn truy cập chính

| làm việc | Lộ trình truy cập |
|---|---|
| Danh sách Bot | Studio > Bot |
| Tạo bot mới | Studio > Bot > Tạo bot |
| Cài đặt Bot | Bot đã chọn > Cài đặt |
| Danh sách phiên bản | Bot đã chọn > Kiểm soát phiên bản |
| Phiên bản không gian làm việc | Bot đã chọn > Phiên bản > Không gian làm việc |

Trước tiên, hãy kiểm tra trạng thái lựa chọn bot/phiên bản trên màn hình, sau đó sửa đổi nội dung phiên bản như ý định, đối tượng, từ điển và QA.

## 4. Nội dung thiết kế hộp thoại

### 4.1 Ý định

Đây là đơn vị phân biệt những gì người dùng yêu cầu. Luồng hội thoại được kết nối với các câu học tập cho từng mục đích phải được xem xét cùng nhau.

Đường dẫn truy cập là `Bot > Phiên bản > Ý định`. Sau khi sửa đổi dữ liệu ý định, hãy kiểm tra trạng thái huấn luyện và kết quả mô phỏng của phiên bản đó.

### 4.2 Đối tượng

Đây là đơn vị trích xuất giá trị hoặc tên cần thiết để xử lý công việc từ một cách nói. Khi sửa đổi một đối tượng, hãy kiểm tra xem ý định liên quan và luồng hộp thoại có được bật hay không.

Đường dẫn truy cập là `Bot > Phiên bản > Thực thể`. Khi thay đổi tên thực thể hoặc tiêu chí trích xuất, hãy đảm bảo rằng ý định hiện tại và cách diễn đạt kiểm tra vẫn hợp lệ.

### 4.3 Từ điển

Nội dung được sử dụng để diễn giải các thuật ngữ tên miền, từ đồng nghĩa và cách diễn đạt của người dùng. Nguyên tắc chi tiết của việc tạo từ điển được giải thích trong Hướng dẫn sử dụng NLU.

Đường dẫn truy cập là `Bot > Phiên bản > Từ điển`. Khi thêm từ đồng nghĩa, hãy phân biệt giữa các biểu thức chỉ ảnh hưởng đến một ý định cụ thể hoặc các biểu thức thường được sử dụng trên nhiều ý định.

### 4.4 Đảm bảo chất lượng

Đây là khu vực quản lý hỏi đáp hoặc kiến thức dựa trên tài liệu. Định dạng tải lên và cấu trúc tài liệu trước tiên được kiểm tra để xem phạm vi nào được màn hình CGA thực tế hỗ trợ.

Đường dẫn truy cập là `Bot > Phiên bản > QA`. Sau khi phản ánh các tài liệu hoặc câu hỏi/câu trả lời, hãy kiểm tra xem trạng thái lập chỉ mục hoặc ứng dụng có được cung cấp hay không và không sử dụng kết quả cho các hoạt động mà không có xác nhận.

### 4.5 Luồng hội thoại

Luồng hội thoại là khu vực tổ chức quy trình xử lý yêu cầu của người dùng bằng cách liên kết yêu cầu đó với ý định.

Đường dẫn truy cập là `Bot > Phiên bản > Luồng hội thoại`. Khi sửa đổi một luồng, hãy kiểm tra những điều sau:

1. Kiểm tra xem luồng được liên kết với ý định nào.
2. Kiểm tra thứ tự phản hồi của người dùng và bot.
3. Kiểm tra xem có bước nào sử dụng đối tượng hoặc biến chung không.
4. Kiểm tra phân nhánh để biết các tình huống chấm dứt, đặt câu hỏi lại và ngoại lệ.
5. Sau khi lưu, hãy kiểm tra riêng các đường dẫn bình thường và ngoại lệ trong trình mô phỏng.

### 4.6 API

Menu API là khu vực quản lý thông tin API liên quan đến việc xử lý cuộc trò chuyện của bot hoặc phiên bản của bạn.


## 5. Kiểm tra/Phân tích/Đánh giá

Hiện tại, các màn hình làm việc sau tồn tại trong CGA cho từng phiên bản.

- Trình mô phỏng: Màn hình để nhập giọng nói và kiểm tra phản hồi
- Phân tích: Màn hình kiểm tra kết quả phân loại tích lũy và các bước phân loại được áp dụng
- Đánh giá: Màn hình kiểm tra dữ liệu và kết quả đánh giá đã chuẩn bị
- Lịch sử hội thoại: Màn hình kiểm tra kết quả hội thoại thực tế hoặc đã lưu
- Retrain: Màn hình phản ánh lại dữ liệu phản hồi hoặc chỉnh sửa

Các đường dẫn truy cập chính như sau:

| làm việc | Lộ trình truy cập |
|---|---|
| giả lập | Bot > Phiên bản > Trình mô phỏng |
| phân tích | Bot > Phiên bản > Phân tích |
| đánh giá | Bot > Phiên bản > Xếp hạng |
| lịch sử hội thoại | Bot > Phiên bản > Lịch sử hội thoại |
| Học lại | Bot > Phiên bản > Đào tạo lại |

Loại trừ/Bỏ qua, Nói nhỏ, So khớp chính xác, Quy tắc, ML, Ngữ nghĩa, LLM, v.v. có thể được hiển thị trong giai đoạn phân loại của màn hình phân tích. Việc giải thích dựa trên các bước phân loại thực tế và các chỉ số hiển thị trên màn hình.

## 6. Quản lý hệ thống

Phạm vi truy cập vào menu quản lý hệ thống có thể khác nhau tùy theo vai trò.

Các nhóm menu hiện tại như sau:

- Quản lý người dùng: quản lý người dùng, lịch sử đăng nhập, quản lý nhóm
- Truy vấn trạng thái: nhật ký hoạt động/hệ thống, trạng thái bot, lịch sử học tập, lịch sử hội thoại, lịch sử cuộc gọi API, lịch sử hàng đợi, phản hồi theo mục đích
- Quản lý hội thoại: Biến phổ biến, Thông báo mặc định
- Kết nối hệ thống: Trạng thái kết nối kênh, trạm bot
- Quản lý khác: Mẫu, Giấy phép

Tên hiển thị thực tế của menu quản trị viên như sau.

- Quản lý người dùng: quản lý người dùng, lịch sử đăng nhập, quản lý nhóm
- Truy vấn trạng thái: Truy vấn nhật ký hoạt động/hệ thống, truy vấn trạng thái bot, truy vấn lịch sử học tập, truy vấn lịch sử hội thoại, truy vấn lịch sử cuộc gọi API, truy vấn lịch sử hàng đợi, truy vấn phản hồi theo mục đích
- Quản lý hội thoại: Quản lý các biến chung, quản lý tin nhắn cơ bản
- Kết nối hệ thống: Quản lý kênh, trạng thái kết nối trạm bot
- Quản lý khác: danh sách mẫu, tra cứu giấy phép

### 6.1 Kênh và Trạm Bot

- `Quản lý kênh`: Quản lý ID kênh, tên kênh, nhà cung cấp, loại trình kết xuất, tính khả dụng và cài đặt kết nối.
- `Trạng thái kết nối Botstation`: Kiểm tra trạng thái liên kết của nhóm, kênh, bot, phiên bản vận hành và kênh đang hoạt động.

Trước khi thay đổi kênh hoặc botstation, hãy kiểm tra phiên bản hoạt động và kênh hoạt động của bot mục tiêu. Nếu kiểm tra kết nối hoặc lưu kết quả không thành công, hãy ghi lại thông báo lỗi và thông tin đích trên màn hình rồi chuyển tiếp cho nhân viên vận hành.

Các hoạt động chi tiết cho từng quyền trong menu quản trị viên được xác nhận sau khi trình duyệt xác minh cho từng vai trò thực tế.

### Kết nối kênh KakaoTalk 6.2

Để kết nối với KakaoTalk, bạn phải hoàn tất cài đặt nhà phát triển Kakao, cài đặt kênh/chatbot KakaoTalk và cài đặt thông tin kết nối CGA theo thứ tự. Chỉ đăng ký kênh trên màn hình CGA sẽ không hoàn tất kết nối KakaoTalk.

> Cảnh báo bảo mật: Thông tin xác thực/kết nối như ID ứng dụng, khóa API REST, URL kỹ năng và tiêu đề hoạt động/kiểm tra không được ghi lại dưới dạng giá trị thực tế trong tài liệu, ảnh chụp màn hình, nhật ký hoặc trình nhắn tin. Giá trị thực tế được nhân viên vận hành xác nhận thông qua đường dẫn phân phối an toàn và chỉ ghi tên mặt hàng và vị trí lưu trữ trong tài liệu.

#### 6.2.1 Chuẩn bị

Xác minh thông tin sau với đại diện hoạt động của bạn:

- ID ứng dụng và ứng dụng Kakao Developers
- Trạng thái kết nối kênh KakaoTalk và kênh doanh nghiệp
- Kênh hoạt động và Chatbot kinh doanh Kakao
- Bot và phiên bản hệ điều hành sử dụng trong CGA
- URL kỹ năng và URL kiểm tra do CGA cấp
- Các tiêu đề kiểm tra và vận hành bắt buộc

Nếu ID ứng dụng hoặc khóa được mã hóa cứng trong tài liệu hoặc màn hình hoặc nếu phiên bản của bot vận hành và bot thử nghiệm khác nhau thì xác nhận kết nối sẽ không được thực hiện.

#### 6.2.2 Cài đặt ứng dụng Kakao Developers

1. Đăng nhập vào [Kakao Developers](https://developers.kakao.com/).
2. Chọn ứng dụng để kết nối từ menu **Ứng dụng**.
3. Kiểm tra tên ứng dụng và ID ứng dụng.
4. Nếu yêu cầu đăng nhập Kakao trong **Đăng nhập Kakao > Chung**, hãy đặt trạng thái thành `ON` và lưu.
5. Kiểm tra thông tin cơ bản về ứng dụng và trạng thái chuyển đổi ứng dụng Biz trong **Chứng nhận doanh nghiệp > Chuyển đổi ứng dụng Biz**.
6. Kiểm tra tính đủ điều kiện của đơn đăng ký và trạng thái xem xét trong **Kênh KakaoTalk > Kết nối kênh doanh nghiệp**.
7. Kiểm tra khóa API REST trong cài đặt ứng dụng nhưng không để lộ giá trị khóa thực tế ra bên ngoài.

Kết nối kênh doanh nghiệp có thể không khả dụng ngay lập tức tùy thuộc vào trạng thái xem xét. Nếu nó đang được xem xét, hãy ghi lại trạng thái thay vì xác định rằng kết nối đã hoàn tất.


#### 6.2.3 Cài đặt kênh KakaoTalk và chatbot

1. Kiểm tra kênh để kết nối trong [KakaoTalk Channel Management Center](https://center-pf.kakao.com/) hoặc Kakao Business Management Center.
2. Đảm bảo rằng kênh có thể được phát hiện và khả dụng.
3. Tạo một chatbot hoặc chọn một chatbot hiện có trong **Công cụ kinh doanh > Chatbots**.
4. Chọn và lưu kênh vận hành sẽ kết nối với CGA trong **Cài đặt > Chọn kênh vận hành** của chatbot.
5. Kiểm tra xem kênh hoạt động và chatbot có được kết nối trong **Kết nối chatbot** trên bảng điều khiển kênh hay không.


#### 6.2.4 Tạo kỹ năng và nhập thông tin kết nối

1. Chọn chatbot mục tiêu trong Trung tâm quản lý Kakao Chatbot.
2. Chọn **Tạo khối mới > Tạo kỹ năng**.
3. Nhập tên kỹ năng. Đặt tên theo quy tắc hoạt động và xác định nó là kỹ năng kết nối CGA.
4. Nhập URL kỹ năng và URL kiểm tra do CGA cấp tương ứng.
5. Nhập tiêu đề vận hành và thử nghiệm tương ứng, nếu cần.
6. Sau khi lưu, hãy kiểm tra URL, URL kiểm tra, trạng thái nhập tiêu đề và các khối áp dụng trên màn hình chi tiết kỹ năng.

URL Kỹ năng và các giá trị sử dụng tiêu đề được cung cấp bởi nhân viên vận hành CGA. Không đoán các giá trị hoặc nhập URL sản xuất và thử nghiệm thay thế cho nhau.

![Màn hình chi tiết Kỹ năng Kakao Connect](screenshots/kakao-skill-detail-masked.png)

Hình 6-2-1. Màn hình chi tiết kỹ năng `Kết nối CGA Kakao`. Các giá trị URL và tiêu đề được che giấu để bảo mật.

#### 6.2.5 Kết nối khối chào mừng và khối dự phòng

1. Mở khối chào mừng của chatbot.
2. Chọn Kỹ năng kết nối CGA trong **Cài đặt tham số**.
3. Chọn **Sử dụng dữ liệu kỹ năng** trong cài đặt phản hồi của bot.
4. Lưu.
5. Đặt kỹ năng kết nối CGA tương tự và **sử dụng dữ liệu kỹ năng** trong khối dự phòng.
6. Kiểm tra lại kết quả lưu và trạng thái kết nối cho từng khối.

Khối chào mừng xử lý mục nhập đầu tiên vào cuộc trò chuyện KakaoTalk và khối dự phòng chuyển tiếp các câu nói thông thường tới CGA. Nếu hai khối sử dụng các kỹ năng khác nhau hoặc phiên bản vận hành khác nhau thì kết quả xử lý cho lời chào ban đầu và phản hồi chung có thể khác nhau.

![Khối chào mừng Kakao](screenshots/kakao-welcome-block.png)

Hình 6-2-2. Cài đặt tham số khối chào mừng và màn hình sử dụng dữ liệu kỹ năng.

![Khối dự phòng Kakao](screenshots/kakao-fallback-block.png)

Hình 6-2-3. Màn hình cài đặt tham số khối dự phòng và sử dụng dữ liệu kỹ năng.

#### 6.2.6 Liên kết đăng ký kênh CGA và phiên bản vận hành

1. Trong CGA Studio, đi tới **Quản lý hệ thống > Quản lý kênh**.
2. Nhập ID kênh và tên kênh sẽ được sử dụng cho kết nối KakaoTalk hoặc chọn kênh hiện có.
3. Kiểm tra nhà cung cấp, loại trình kết xuất, tính khả dụng và cài đặt kết nối.
4. Kiểm tra bot bạn đang kết nối và phiên bản hoạt động của nó.
5. Sau khi lưu, hãy kiểm tra trạng thái kết nối trên màn hình quản lý kênh.
6. Kiểm tra xem sự kết hợp giữa nhóm, kênh, bot, phiên bản vận hành và kênh hoạt động có chính xác trong **Trạng thái kết nối Botstation** hay không.

#### 6.2.7 Kiểm tra kết nối

1. Tìm kiếm kênh được kết nối với KakaoTalk và mở phòng trò chuyện.
2. Đảm bảo rằng lời chào mặc định của CGA được hiển thị ở mục nhập đầu tiên.
3. Nhập câu nói thông thường tương ứng với ý định đã đăng ký.
4. Đảm bảo rằng kết quả luồng hội thoại và phân loại NLU của CGA được hiển thị trong phản hồi.
5. Xác minh rằng lời nói và phản hồi của người dùng được lưu trong lịch sử hội thoại CGA.
6. Kiểm tra xem giá trị kênh trong lịch sử là `Kakao` hay giá trị kênh Kakao được xác định trong môi trường hoạt động.
7. Xác minh rằng thông tin về bot, phiên bản vận hành và kênh phù hợp với đối tượng mục tiêu.

Các điều kiện để hoàn thành kết nối như sau.

- Khối chào mừng và khối dự phòng gọi kỹ năng kết nối CGA.
- Cả hai khối đều được thiết lập để sử dụng dữ liệu kỹ năng.
- Lời chào đầu tiên và phản hồi chung đến từ cài đặt bot CGA, không phải cụm từ cài đặt Kakao.
- Thông tin về bot, phiên bản và kênh Kakao vẫn còn trong lịch sử hội thoại CGA.

Nếu kết nối không thành công, hãy kiểm tra trạng thái kênh Kakao, kênh vận hành chatbot, URL/tiêu đề kỹ năng, khối chào mừng/dự phòng, nhà cung cấp kênh CGA và phiên bản hoạt động theo thứ tự đó. Không sao chép hoặc tự ý thay đổi khóa, tiêu đề trong tài liệu.


#### 6.2.8 Vị trí chèn ảnh chụp màn hình CGA

Màn hình CGA sau sẽ chèn ảnh chụp sau khi kiểm tra các quyền và trạng thái kết nối của môi trường vận hành thực tế.


Khi chèn ảnh chụp, trước tiên hãy che thông tin nhạy cảm như tên tài khoản, ID ứng dụng, khóa API REST, URL kỹ năng, tiêu đề xác thực và thông tin cá nhân.

## 7. Trình tự xác nhận cơ bản khi xảy ra sự cố

1. Xác minh rằng bot và phiên bản hiện tại là chính xác.
2. Kiểm tra trạng thái kết hợp của phương pháp, mô hình và phương thức trả lời NLU đã chọn.
3. Xác minh rằng dữ liệu cần thiết đã được lưu.
4. Kiểm tra trạng thái đào tạo/lập chỉ mục/áp dụng.
5. Kiểm tra lại cách nói tương tự trong trình mô phỏng.
6. Kiểm tra kết quả trong lịch sử phân tích/đánh giá/đối thoại.

Nếu nguyên nhân và kết quả không được xác nhận trên màn hình, không trực tiếp thao tác DB hoặc CLI mà truyền đạt bot, phiên bản, thông báo lỗi và thời gian xuất hiện trên màn hình cho người quản lý vận hành.

### Trong trường hợp không học ngay cả sau khi yêu cầu học

1. Nhấn nút Tìm hiểu và kiểm tra xem thông báo `Yêu cầu huấn luyện NLU đã được thêm vào hàng đợi.` có hiển thị hay không.
2. Xác minh rằng nút Tìm hiểu thay đổi thành `Đang huấn luyện`.
3. Sau khi làm mới, hãy kiểm tra xem trạng thái phiên bản có thay đổi thành `Đã huấn luyện` hoặc Có sẵn hay không.
4. Kiểm tra thời gian bắt đầu, thời gian hoàn thành và trạng thái học tập của cùng một bot/phiên bản trong yêu cầu lịch sử học tập.
5. Nếu nó hiển thị lại là `Chưa huấn luyện` hoặc không có lịch sử học tập, đừng đánh giá đó là thành công mà hãy truyền đạt bot, phiên bản, công cụ học tập và thời gian yêu cầu cho nhân viên vận hành.

Yêu cầu huấn luyện được đưa vào Queue và do Worker riêng xử lý bất đồng bộ. Huấn luyện ML và Semantic có thể mất hơn ba phút tùy dữ liệu và môi trường; chỉ kiểm tra sau khi lịch sử huấn luyện hiển thị thành công hoặc trạng thái đã huấn luyện.

## 8. Quy trình chung cho các thao tác trên menu

Thứ tự sau thường được áp dụng khi sử dụng các menu Ý định, Đối tượng, Từ điển, QA, Luồng hộp thoại và API.

1. **Mục đích**: Trong một câu, hãy xác định kết quả công việc bạn muốn thay đổi với nhiệm vụ này.
2. **Đường dẫn truy cập**: Chọn đúng bot và phiên bản rồi điều hướng đến menu tương ứng.
3. **Thành phần màn hình**: Trước tiên hãy kiểm tra giá trị hiện tại, trạng thái lựa chọn, lỗi/cảnh báo và các mục không hoạt động.
4. **Quy trình sử dụng**: Chỉ thay đổi các mục cần thiết và ghi lại các giá trị trước khi thay đổi.
5. **Lưu/Áp dụng kết quả**: Kiểm tra thông báo lưu và trạng thái học/lập chỉ mục/áp dụng.
6. **Thận trọng**: Kiểm tra tác động lên mục đích/luồng/kênh/phiên bản liên quan.
7. **Tài liệu liên quan**: Nếu đó là vấn đề về động cơ hoặc chất lượng, hãy kiểm tra [Hướng dẫn sử dụng NLU](../cga-nlu-guide/README.md).

Chỉ thông báo lưu thành công không xác định được rằng phản ánh hoạt động đã được hoàn thành. Nếu bạn cần kết quả sử dụng thực tế, hãy kiểm tra kết quả trong trình mô phỏng, phân tích và lịch sử hội thoại.

## 9. Bảng thuật ngữ

| Thuật ngữ | Mô tả |
|---|---|
| bot | Đơn vị dịch vụ nói chuyện với người dùng |
| Trung tâm Bot | Một đơn vị quản lý nhiều bot |
| phiên bản | Đơn vị quản lý cài đặt bot và thiết kế cuộc trò chuyện riêng biệt |
| ý định | Đơn vị phân loại mục đích yêu cầu của người dùng |
| đối tượng | Một giá trị hoặc tên được trích xuất từ ​​một cách phát âm |
| NLU | Vùng chức năng diễn giải ngôn ngữ đầu vào tự nhiên của người dùng |
| Học tập | Nhiệm vụ phản ánh dữ liệu đã đăng ký để động cơ có thể sử dụng |
| Lập chỉ mục | Chuẩn bị cấu trúc tìm kiếm dữ liệu để truy xuất |
| RAG | Cách sử dụng kết hợp kiến ​​thức được truy xuất và mô hình tổng quát |

## Tài liệu liên quan

- [Xem tất cả hướng dẫn sử dụng CGA](../README.md)
- [Bắt đầu CGA](../cga-getting-started/README.md)
- [Hướng dẫn sử dụng CGA NLU](../cga-nlu-guide/README.md)
