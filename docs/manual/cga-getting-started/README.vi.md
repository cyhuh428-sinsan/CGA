# Bắt đầu với CGA

Đối tượng: Người dùng mới làm quen với CGA

Tài liệu này hướng dẫn bạn cách tạo bot đầu tiên trong CGA và xem kết quả của các thử nghiệm đầu tiên. Thực hiện theo từng bước, kiểm tra kết quả mong đợi của từng bước trước khi chuyển sang bước tiếp theo.


## Đã hoàn thành trong tài liệu này

Nếu bạn đọc hết các hướng dẫn này, bạn sẽ có thể:

- Bạn có thể chuẩn bị các thông tin cần thiết trước khi tạo bot mới.
- Bạn có thể quyết định nên chọn phương pháp NLU nào trong số ML·Semantic·LLM.
- Bạn có thể kiểm tra kiểu máy, phương thức phản hồi và trạng thái hỗ trợ trên màn hình tạo.
- Sau khi tạo bot, bạn sẽ biết những gì cần tìm trong quá trình đào tạo hoặc lập chỉ mục và thử nghiệm đầu tiên.

## Chuẩn bị trước khi bắt đầu

- Tài khoản CGA Studio
- Tên bot cần tạo
- Một câu nói ngắn gọn của người dùng để thử nghiệm.
- Lựa chọn mặc định cho phương pháp NLU nào sẽ sử dụng


Nếu bạn cần tiêu chí lựa chọn chi tiết cho động cơ, trước tiên vui lòng kiểm tra [Hướng dẫn sử dụng NLU](../cga-nlu-guide/README.md).

### Ví dụ chuẩn bị tối thiểu cho lần sử dụng đầu tiên

Đừng thêm nhiều chức năng ngay từ đầu, hãy kiểm tra luồng màn hình bằng một ý định và các câu kiểm tra ngắn gọn.

| Hạng mục chuẩn bị | Ví dụ |
|---|---|
| tên bot | Testbot điều tra kỳ nghỉ |
| ý định | Kiểm tra số ngày nghỉ còn lại |
| Ví dụ về học câu | Còn bao nhiêu ngày được nghỉ phép? |
| thử nghiệm đánh lửa | Kỳ nghỉ còn lại bao nhiêu? |
| Phương pháp trả lời đầu tiên | câu trả lời đã được thiết lập |

Ví dụ trên nhằm mục đích giải thích cách sử dụng tài liệu và không nhằm mục đích sử dụng làm dữ liệu hoặc câu trả lời kinh doanh thực tế của công ty.

## Bước 1. Đăng nhập

### Mục đích

Vào màn hình làm việc CGA Studio.

### hoạt động

1. Mở màn hình đăng nhập CGA Studio.
2. Nhập thông tin tài khoản của bạn.
3. Chọn nút Đăng nhập.

### Kết quả mong đợi

Bảng điều khiển hoặc màn hình chào mừng của CGA Studio phù hợp với quyền của bạn được hiển thị.

### Nếu xảy ra sự cố

Nếu bạn quay lại màn hình đăng nhập hoặc thấy lỗi quyền, hãy kiểm tra trạng thái tài khoản và vai trò của bạn bằng Operations.

## Bước 2. Tạo bot mới

### Mục đích

Nhập thông tin cơ bản cho bot bạn muốn kiểm tra.

### hoạt động

1. Chuyển đến màn hình tạo bot.
2. Chọn `Bot` trong Loại Bot.
3. Chọn loại văn bản hoặc loại giọng nói.
4. Bây giờ bạn có thể chọn hình ảnh PC trong khu vực hồ sơ.
5. Nhập tên bot vào trường `Nhập tên bot.`.
6. Kiểm tra `Tiếng Hàn` bằng ngôn ngữ.
7. Nếu cần, hãy nhập phần giới thiệu vào trường `Nhập câu giới thiệu mô tả bot.`.

### Kết quả mong đợi

Màn hình tạo bot hiển thị trạng thái lựa chọn và thông tin cơ bản được nhập vào tóm tắt cấu trúc.

### Nếu xảy ra sự cố

Nếu xuất hiện lỗi tên bot, hãy nhập lại bất kỳ ký tự nào không phù hợp với hướng dẫn trên màn hình hoặc rút ngắn độ dài.

Kiểm tra các mục sau trước khi nhập:

- Làm cách nào để tránh nhầm lẫn tên bot của tôi với các bot khác?
- Bạn đã chuẩn bị bài phát biểu dưới dạng một câu chưa?
- Bạn có sử dụng dữ liệu vận hành thực tế hoặc thông tin cá nhân để nhập bài kiểm tra không?

## Bước 3. Chọn phương thức NLU

### Mục đích

Chọn công cụ sẽ diễn giải lời nói của người dùng.

### hoạt động

Trong `Phương thức NLU`, chọn một trong các tùy chọn sau:

- `ML`
- `Semantic - Vector Worker`
- `Semantic - External Embedding`
- `LLM Engine`

### Kết quả mong đợi

Kiểu NLU và các mục cài đặt bổ sung phù hợp với phương pháp đã chọn sẽ được hiển thị. Ví dụ: nếu bạn chọn `Semantic - External Embedding`, mô hình nhúng và các mục kết nối Intent Vector DB sẽ được hiển thị và nếu bạn chọn `LLM Engine`, các mục Nhà cung cấp và mô hình chi tiết sẽ được hiển thị.

### Khi chọn lần đầu tiên

- Xem lại ML làm điểm khởi đầu để trực tiếp thiết kế các câu và ý định học tập.
- Nếu cấu trúc sử dụng tính tương tự về ngữ nghĩa và Vector DB, hãy xem xét Ngữ nghĩa.
- Xem lại LLM nếu bạn đã sẵn sàng vận hành mô hình với Nhà cung cấp LLM.

Để biết lựa chọn cụ thể, hãy tham khảo [Bảng so sánh động cơ](../cga-nlu-guide/engine-comparison.md).

## Bước 4. Kiểm tra model và cách trả lời

### Mục đích

Kiểm tra các mô hình và phương pháp trả lời cần thiết cho phương pháp NLU đã chọn.

### Hoạt động

1. Kiểm tra các mẫu có sẵn trong `Mô hình NLU`.
2. Trong `Phương thức trả lời`, hãy kiểm tra xem mục nào có thể được chọn trong số câu trả lời đã đặt, câu trả lời RAG của Công cụ Ngữ nghĩa, câu trả lời RAG của Công cụ LLM và câu trả lời của Công cụ LLM.
3. Kiểm tra trạng thái hỗ trợ của tổ hợp lựa chọn.
4. Khi kiểm tra cài đặt lần đầu tiên, hãy đảm bảo rằng tổ hợp `ML` + `DeepLearning Lite` + `Câu trả lời cố định` được hiển thị dưới dạng `Sẵn sàng chạy/huấn luyện`.

### Kết quả mong đợi

Tóm tắt cấu trúc hiển thị ngôn ngữ, phương pháp NLU, mô hình NLU, phương pháp trả lời, LLM và phiên bản.

### Nếu xảy ra sự cố

Nếu một kết hợp được đánh dấu là không có sẵn, hãy chọn một phương pháp trả lời khác hoặc phương pháp NLU. Chúng tôi sẽ không tiếp tục quá trình sáng tạo của bạn nếu không kiểm tra trạng thái đơn đăng ký của bạn.

## Bước 5. Chuẩn bị tối thiểu cho từng động cơ

Việc chuẩn bị từ giai đoạn này sẽ khác nhau tùy thuộc vào động cơ được chọn.

### M.L.

Chuẩn bị ý định và câu học tập. Viết sao cho mỗi câu nói chỉ chứa đựng một ý định và chuẩn bị các cách diễn đạt riêng biệt cho những ý định tương tự.

Đầu tiên, chỉ chuẩn bị một ý định và một vài câu học tập rồi kiểm tra luồng màn hình, sau đó kiểm tra xem nó có thành công hay không và mở rộng phạm vi.

### Ngữ nghĩa

Chuẩn bị ý định hoặc kiến thức mục tiêu tìm kiếm và điều kiện kết nối Vector DB. Nếu bạn chọn nhúng bên ngoài, hãy kiểm tra địa chỉ API tìm kiếm và các điều kiện tương thích của mô hình nhúng.

### L.L.M.

Chọn Nhà cung cấp LLM và mô hình chi tiết, đồng thời chuẩn bị địa chỉ cuộc gọi mô hình và chỉ thị trả lời nếu cần.

Việc tạo dữ liệu chi tiết và cải thiện chất lượng cho từng công cụ được đề cập trong chương tương ứng của [Hướng dẫn sử dụng NLU](../cga-nlu-guide/README.md).

## Bước 6. Tạo, học, chuẩn bị chỉ mục

### Mục đích

Chuẩn bị dữ liệu và cài đặt bot đã nhập để sử dụng trong CGA.

### hoạt động

1. Kiểm tra lại các giá trị đầu vào và tổ hợp động cơ.
2. Chọn nút `Xác nhận` trên màn hình tạo.
3. Kiểm tra kết quả tạo và trạng thái phiên bản.
4. Chạy mọi công việc đào tạo hoặc chuẩn bị chỉ mục cần thiết cho công cụ đã chọn.
5. Xác minh rằng trạng thái đã thay đổi thành Đã hoàn thành hoặc Có sẵn.

### Kết quả mong đợi

Bot và phiên bản được tạo và trạng thái sẵn sàng được hiển thị cho công cụ đã chọn.


### Khi việc hoàn thành học tập không được xác nhận

Nếu nút học thay đổi thành `Đang huấn luyện` và sau khi làm mới, nó lại hiển thị `Huấn luyện` và `Chưa huấn luyện` thì việc học không thành công. Chúng tôi kiểm tra thời gian và trạng thái hoàn thành trong yêu cầu lịch sử đào tạo và nếu không có kết quả, chúng tôi sẽ không sử dụng bài kiểm tra mô phỏng để kiểm tra chất lượng.

## Bước 7. kiểm tra đầu tiên

### Mục đích

Đảm bảo rằng lời nói của người dùng được xử lý thông qua công cụ đã chọn.

### Hoạt động

1. Chuyển đến màn hình phiên bản làm việc của bot bạn đã tạo.
2. Mở trình mô phỏng.
3. Nhập câu kiểm tra ngắn mà bạn đã chuẩn bị.
4. Chạy thử nghiệm.

### Kết quả mong đợi

Kết quả phản hồi và phân loại được hiển thị.

### Nếu xảy ra sự cố


Thu hẹp phạm vi theo thứ tự sau:

1. Xác minh rằng bot và phiên bản hiện được chọn có đủ điều kiện để thử nghiệm.
2. Kiểm tra trạng thái kết hợp của phương pháp NLU, mô hình và phương pháp trả lời.
3. Kiểm tra trạng thái sẵn sàng đào tạo hoặc lập chỉ mục và thông báo lỗi.
4. Nhập lại cách phát âm đại diện và các cách phát biểu biến thể khác tương ứng.
5. Nếu lỗi vẫn tiếp tục, bot, phiên bản, động cơ, hoạt động và thời gian lỗi sẽ được ghi lại và gửi đến người quản lý vận hành.

## Bước 8. Kiểm tra kết quả và tìm hiểu tiếp theo

Sau lần kiểm tra đầu tiên, hãy kiểm tra kết quả trên màn hình tiếp theo.

- Trình mô phỏng: Phát ngôn đầu vào và phản hồi ngay lập tức
- Phân tích: Kết quả phân loại tích lũy và các bước áp dụng
- Đánh giá: Dữ liệu và kết quả đánh giá
- Lịch sử hội thoại: Lịch sử hội thoại đã lưu

Nếu kết quả không đủ, hãy kiểm tra hướng dẫn sử dụng NLU để biết quy trình xác thực và cải thiện dữ liệu cho từng động cơ.

## Sử dụng Getting Started trên màn hình

Mở `?` ở góc dưới bên trái và chọn `Bắt đầu`. Hướng dẫn hiển thị trên màn hình CGA hiện tại và có thể đóng bất kỳ lúc nào.

| Quy trình | Tám bước |
|---|---|
| Khám phá menu | Bot → API → Admin → ý định và câu huấn luyện → thực thể và từ điển → đánh giá → huấn luyện lại → phân tích |
| Tạo bot | tạo bot → động cơ ý định → mô hình và cách trả lời → ý định và câu huấn luyện → thực thể, từ điển và luồng → huấn luyện → Bot Test → cải thiện |

Chọn quy trình rồi nhấn `Bắt đầu`. Dùng `Trước`, `Tiếp` hoặc số bước. `Xem quy trình khác` dùng để chuyển quy trình. Ở bước cuối, `Kết thúc` mở danh sách bot hoặc màn hình tạo bot. Tùy chọn không hiển thị khi khởi động chỉ được lưu trong trình duyệt hiện tại; vẫn có thể mở lại từ Trợ giúp.

## Tài liệu tiếp theo

- [Xem tất cả hướng dẫn sử dụng CGA](../README.md)
- [Hướng dẫn sử dụng CGA](../cga-user-manual/README.md)
- [Hướng dẫn sử dụng CGA NLU](../cga-nlu-guide/README.md)
