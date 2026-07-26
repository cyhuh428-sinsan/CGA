# Hướng dẫn sử dụng CGA NLU

Đối tượng: Người vận hành thiết kế bot/hộp thoại, chuyên gia AI/NLU

Tài liệu này chọn các công cụ `ML`, `Semantic` và `LLM` của CGA và sắp xếp dữ liệu, cài đặt, thử nghiệm và các phương pháp cải thiện chất lượng cho từng công cụ.


## 1. Các khái niệm cơ bản của NLU

- Ý định: Đơn vị phân loại cho biết lời nói của người dùng đang yêu cầu điều gì.
- Câu học tập: Biểu thức của người dùng được đăng ký để học mục đích hoặc sử dụng làm tiêu chí tìm kiếm.
- Thực thể: Giá trị kinh doanh hoặc tên phải được trích xuất từ ​​cách phát âm.
- Từ điển: Tài sản để giải thích các thuật ngữ tên miền, từ đồng nghĩa và cách diễn đạt của người dùng
- Ngưỡng: Tiêu chí tối thiểu để chấp nhận kết quả là có thể sử dụng được.
- Tương tự: Một giá trị cho biết mức độ gần gũi giữa dữ liệu đầu vào và dữ liệu ứng cử viên.
- Công cụ trả lời: Khu vực chọn câu trả lời cho trước hoặc tìm kiếm/tạo câu trả lời dựa trên kết quả phân loại

## 2. Tiêu chí lựa chọn động cơ

| Danh mục | ML | Ngữ nghĩa | L.L.M. |
|---|---|---|---|
| Phương pháp cơ bản | Phân loại dựa trên ý định và câu học tập | Nhúng và tập trung tìm kiếm vector | Mô hình LLM và xử lý dựa trên chỉ thị |
| dữ liệu sẵn sàng | Ý định, câu học, đối tượng, từ điển | Ý định hoặc tìm kiếm kiến ​​thức, nhúng·Vector DB | Ý định, Chỉ thị, Nhà cung cấp·Mô hình |
| Một điểm khởi đầu tốt | Khi có sự phân biệt được ý định làm việc và quản lý câu học | Khi bạn cần tìm kiếm ý nghĩa tương tự mặc dù các cách diễn đạt khác nhau | Khi cần phân tích/tạo và vận hành mô hình dựa trên LLM |
| Xác minh khóa | Chính xác, phân loại sai, cân bằng câu | Tìm kiếm tương tự, ngưỡng, trạng thái chỉ mục | Tính nhất quán của phản hồi, tuân thủ hướng dẫn, độ trễ/chi phí |
| Rủi ro chính | Ý định trùng lặp, mất cân bằng dữ liệu | Khả năng tương thích nhúng, chỉ mục không khớp | Thay đổi mô hình, Tác động nhanh chóng, Độ lệch phản ứng |

Mô hình chi tiết và trạng thái hỗ trợ được kiểm tra dựa trên các lựa chọn có sẵn trên màn hình tạo bot.

## 3. Quy trình vận hành chung

1. Kiểm tra bot và phiên bản.
2. Kiểm tra phương pháp và mô hình NLU.
3. Kiểm tra phương pháp trả lời.
4. Chuẩn bị thiết lập dữ liệu hoặc kết nối.
5. Thực hiện các tác vụ đào tạo, tạo chỉ mục và ứng dụng mô hình.
6. Kiểm tra các câu nói đại diện trong trình mô phỏng.
7. Kiểm tra kết quả trong lịch sử phân tích/đánh giá/đối thoại.
8. Phân loại nguyên nhân, sửa dữ liệu và kiểm tra lại.

## 4. Nguyên tắc chung về kiểm tra chất lượng

- Một câu đào tạo chứa một ý định cốt lõi.
- Các ý định tương tự bao gồm danh từ, động từ và tình huống có thể phân biệt được với nhau.
- Kiểm tra sự cân bằng để tránh làm quá tải dữ liệu cho các ý định cụ thể.
- Trước tiên, hãy xác định xem thuật ngữ miền sẽ được quản lý dưới dạng đối tượng hay từ điển.
- Câu kiểm tra không chỉ lặp lại cách diễn đạt giống như câu huấn luyện.
- Trước tiên hãy cải thiện các cặp ý định có sự phân loại sai lặp đi lặp lại trong kết quả phân tích.

### 4.2 Quy tắc viết câu học tập

Lưu ý Khi áp dụng các nguyên tắc của Hướng dẫn NLU cho dữ liệu vận hành CGA, hãy sử dụng trình tự sau:

1. Đặt tên cho ý định để chỉ mục đích của nhiệm vụ.
2. Chỉ có một yêu cầu cốt lõi được đưa vào một câu đào tạo.
3. Chuẩn bị cùng một ý định nhưng có thứ tự từ, giọng điệu và cách diễn đạt khác nhau.
4. Đừng chỉ nhân lên những từ trùng lặp với các ý định khác, mà hãy bao gồm ngữ cảnh và hành động giúp phân biệt ý định.
5. Không đăng ký các câu giống nhau hoặc gần giống nhau nhiều lần.
6. So sánh từng ý định để đảm bảo rằng các câu không chỉ tập trung vào một ý định cụ thể.

Ví dụ: khi chia `Kiểm tra số ngày nghỉ còn lại` và `Cách đăng ký nghỉ phép`, hãy chuẩn bị các biểu thức tiết lộ tiêu chí phân chia, chẳng hạn như `Số ngày còn lại` và `Quy trình đăng ký`, thay vì bao gồm từ `Nghỉ phép` trong cả hai ý định.

### 4.3 QA/Quy tắc tạo dữ liệu kiến thức

Khi chuẩn bị kiến thức dựa trên tài liệu hoặc QA, hãy rõ ràng về phạm vi của câu hỏi và câu trả lời.

- Các câu hỏi được viết bằng biểu thức mà người dùng thực tế có thể nhập.
- Câu trả lời phải được viết trực tiếp cho câu hỏi và không trộn lẫn nhiều chủ đề trong một câu trả lời.
- Đối với dữ liệu dựa trên tài liệu, cấu trúc văn bản gốc được sắp xếp sao cho duy trì sự khác biệt giữa tiêu đề và nội dung.
- Nếu bảng hoặc danh sách quan trọng, hãy đảm bảo rằng ý nghĩa được duy trì sau khi chuyển đổi.
- Khi sửa đổi tài liệu, hãy kiểm tra trạng thái đơn đăng ký để đảm bảo rằng tài liệu hiện có và tài liệu mới không được tìm kiếm cùng một lúc.


### 4.1 Biên bản kiểm tra vận hành

Khi thay đổi cài đặt động cơ hoặc dữ liệu huấn luyện, hãy ghi lại các mục sau.

- Bot và phiên bản
- Phương pháp NLU, mô hình, phương pháp trả lời trước và sau khi thay đổi
- Đã thay đổi cài đặt mục đích/đối tượng/từ điển/QA hoặc kết nối
- Đã thực hiện các thao tác học/lập chỉ mục/áp dụng và trạng thái màn hình
- Các câu nói thành công và thất bại tiêu biểu
- Kết quả mô phỏng/phân tích/đánh giá trước và sau khi thay đổi

Nếu không có bản ghi này, rất khó để tách biệt tác động của những thay đổi động cơ với tác động của những thay đổi dữ liệu.

## 5. Hướng dẫn cho từng loại động cơ

- [Sử dụng công cụ ML](#6-sử-dụng-ml-engine)
- [Sử dụng công cụ ngữ nghĩa](#7-sử-dụng-công-cụ-ngữ-nghĩa)
- [Sử dụng động cơ LLM](#8-sử-dụng-công-cụ-llm)

## 6. Sử dụng ML Engine

### 6.1 Cài đặt

Các mục được xác định là mô hình ML trong màn hình hiện tại là DeepLearning Lite, TF-IDF Linear và Đường cơ sở từ khóa. Trạng thái kết nối học tập thực tế được kiểm tra cùng với cài đặt phiên bản và trạng thái có thể lựa chọn.

### 6.2 Ghi dữ liệu

- Chuẩn bị các biểu thức đại diện và các biểu thức khác nhau cho từng ý định.
- Chỉ chứa một ý định cho mỗi câu lệnh.
- Các ý định yêu cầu phân biệt, chẳng hạn như truy vấn phương thức và lỗi, không trộn lẫn các biểu thức.
- Kiểm tra số lượng câu cho từng ý định và sự đa dạng trong cách diễn đạt.

### 6.3 Thử nghiệm và cải tiến

1. Chuẩn bị các câu nói đại diện và các câu nói ranh giới tương ứng.
2. Kiểm tra kết quả trong trình mô phỏng.
3. Tìm kiếm mục đích phân loại sai và các biểu thức lặp lại trong màn hình phân tích/đánh giá.
4. Sửa dữ liệu để phát hiện sự khác biệt giữa các ý định cạnh tranh.
5. Luyện tập lại và lặp lại bài kiểm tra tương tự.

### 6.4 Biện pháp phòng ngừa

Chúng tôi không cho rằng chất lượng sẽ tự động được cải thiện chỉ bằng cách tăng số lượng câu huấn luyện. Thay vì thay đổi hậu tố đơn giản, chúng tôi thêm các biểu thức chính để phân biệt ý định và các biểu thức khác nhau với người dùng thực tế.

Kiểm tra trước khi thay đổi ML:

1. Trong một câu, hãy giải thích tiêu chí để phân biệt với mục đích cạnh tranh.
2. Kiểm tra xem mỗi ý định có biểu thức đại diện, biểu thức biến thể hay biểu thức ranh giới hay không.
3. Kiểm tra xem không có câu học tập nào trộn lẫn nhiều ý định trong một câu.
4. Kiểm tra lại xem các phát biểu thành công trước khi thay đổi có được duy trì sau khi thay đổi hay không.

## 7. Sử dụng Công cụ ngữ nghĩa

### Loại 7.1

- `Semantic - Vector Worker`: Loại sử dụng mô hình cơ bản CGA Vector Worker và Local Vector DB
- `Semantic - External Embedding`: Loại kết nối nhúng bên ngoài và DB Vector cục bộ

### 7.2 Cài đặt

Khi bạn chọn NLU ngữ nghĩa, cài đặt kết nối Intent Vector DB sẽ được hiển thị. Trong loại Nhúng bên ngoài, có thể sử dụng địa chỉ API tìm kiếm, đầu vào lựa chọn Khóa API và tên chỉ mục. Loại Vector Worker mặc định sẽ giải quyết kết nối mặc định và tên Chỉ mục.

### 7.3 Lựa chọn kiểu máy

Mã hiện tại xác định các tùy chọn nhúng bên ngoài như `ko-sroberta` cho các tài liệu chung bằng tiếng Hàn, `multilingual-e5` cho đa ngôn ngữ, bảng và định dạng và `bge-m3` cho các tài liệu cũng như điều khoản và điều kiện dài. Lựa chọn hoạt động thực tế là kiểm tra chung các đặc điểm tài liệu, khả năng kết nối hoạt động và khả năng tương thích nhúng.

### 7.4 Thử nghiệm và cải tiến

1. Chuẩn bị các câu hỏi và cách diễn đạt tiêu biểu.
2. Kiểm tra xem dữ liệu ý định hoặc kiến ​​thức có được phản ánh trong Vector DB hay không.
3. Trong trình mô phỏng, các biểu thức có cùng ý nghĩa và các biểu thức có ý nghĩa khác nhau được kiểm tra riêng biệt.
4. Kiểm tra kết quả tìm kiếm, độ tương tự, ngưỡng và trạng thái chỉ mục.
5. Nếu tìm kiếm không khớp, hãy kiểm tra sự kết hợp giữa dữ liệu, nhúng và lập chỉ mục.


Kiểm tra trước khi thay đổi ngữ nghĩa:

1. Xác minh rằng mô hình nhúng và dữ liệu đang tìm kiếm có tương thích hay không.
2. Xác minh rằng tên Chỉ mục và mục tiêu kết nối khớp với phiên bản bot hiện tại.
3. Nếu bạn sử dụng API tìm kiếm bên ngoài, hãy kiểm tra với quản trị viên của bạn để biết thông số phản hồi và cài đặt xác thực.
4. Kết quả trước khi cập nhật chỉ mục không được hiểu là chất lượng của dữ liệu mới.

## 8. Sử dụng công cụ LLM

### 8.1 Cài đặt

Nếu bạn chọn LLM Engine, bạn có thể đặt Nhà cung cấp LLM và mô hình chi tiết cho từng nhà cung cấp. Các lựa chọn nhà cung cấp được xác nhận trên màn hình là Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama và OpenRouter. Ví dụ: nếu bạn chọn ChatGPT, bạn sẽ thấy `GPT-4o mini (Mặc định)` và `GPT-4o (Chất lượng cao)`. Danh sách nhà cung cấp và kiểu máy có thể khác nhau tùy thuộc vào cài đặt vận hành của bạn và nếu sử dụng Ollama, bạn có thể thấy các mục nhập địa chỉ riêng biệt.

### 8.2 Hướng dẫn và phương thức phản hồi

LLM nên xem xét việc lựa chọn mô hình NLU và lựa chọn phương pháp trả lời cùng nhau.

- Câu trả lời của LLM Engine: Cách LLM tạo ra câu trả lời
- LLM Engine RAG Trả lời: Cách sử dụng kết hợp kiến thức đã truy xuất và LLM
- Câu trả lời được xác định: Cách sử dụng câu trả lời được xác định trước

Hướng dẫn ghi lại giọng điệu, định dạng phản hồi và các giới hạn một cách rõ ràng. Sau khi thay đổi một lệnh, chúng tôi so sánh các phản hồi nhất quán và ngoại lệ với cùng một bộ kiểm tra.

### 8.3 Thử nghiệm và cải tiến

1. Chuẩn bị các câu hỏi mang tính đại diện, các câu hỏi mơ hồ và các câu hỏi bị cấm hoặc ngoại lệ.
2. Nhà cung cấp dịch vụ sửa chữa và mô hình chi tiết.
3. Lặp lại cùng một đầu vào để kiểm tra tính nhất quán của phản hồi.
4. Xác minh việc tuân thủ chỉ thị và cơ sở cho phản hồi của bạn.
5. Ghi lại sự chậm trễ, chi phí và phản hồi lỗi.


Kiểm tra trước khi thay đổi LLM:

1. Ghi lại nhà cung cấp và mô hình chi tiết trước và sau khi thay đổi.
2. So sánh bằng cách sử dụng cùng một phương thức nhập/lệnh/phản hồi.
3. Kiểm tra riêng biệt tính hiện thực, tuân thủ định dạng, phản hồi bị cấm và phản hồi lỗi.
4. Nếu sự chậm trễ hoặc chi phí là đáng kể, hãy ghi lại chúng bằng kết quả chất lượng.

## 9. Phân tích và cải tiến chất lượng

Màn hình phân tích kiểm tra kết quả phân loại tích lũy và các bước được áp dụng. Các bước phân loại hiện được hiển thị trên màn hình có thể bao gồm Loại trừ/Bỏ qua, Nói nhỏ, So khớp chính xác, Quy tắc, ML, Ngữ nghĩa, LLM, v.v.

Trình tự cải tiến chất lượng:

1. Thu thập các phát biểu không thành công.
2. Kiểm tra các bước phân loại được áp dụng thực tế.
3. Cô lập vấn đề thuộc lĩnh vực nào: ý định, tìm kiếm, chỉ thị hoặc phản hồi.
4. Sửa phạm vi dữ liệu tối thiểu.
5. Cùng nhau kiểm tra lại các câu nói thành công và thất bại hiện có.

### 9.1 Cấu hình bộ kiểm tra

Khi thay đổi động cơ hoặc sửa đổi dữ liệu, không chỉ sử dụng một câu kiểm tra.

| bộ kiểm tra | Mục đích | Tiêu chuẩn ví dụ |
|---|---|---|
| Bài phát biểu đại diện | Kiểm tra đường dẫn sử dụng chính thông thường | Biểu thức thường được sử dụng |
| Cách nói sửa đổi | Kiểm tra quá trình xử lý các thay đổi biểu thức | Những thay đổi về thứ tự từ, giọng điệu và khoảng cách |
| phát biểu ranh giới | Đảm bảo sự khác biệt với ý định cạnh tranh | Các yêu cầu khác có từ tương tự |
| phát biểu ngoại lệ | Kiểm tra việc xử lý các yêu cầu không được hỗ trợ/không rõ ràng | Các câu hỏi không nằm trong mục đích |
| phát biểu đệ quy | Xác nhận duy trì kết quả thành công trước khi thay đổi | Lời nói thành công trước đây |

Bạn phải sử dụng cùng một bộ trước và sau khi thay đổi để so sánh ảnh hưởng của việc thay đổi động cơ hoặc bổ sung dữ liệu. Kết quả kiểm tra được ghi lại cùng với bot, phiên bản, động cơ, kiểu máy và phương thức phản hồi.

## 10. Phản hồi lỗi

| Triệu chứng | Kiểm tra trước | Hành động tiếp theo |
|---|---|---|
| Không được phân loại là mục đích dự kiến ​​| Bot·Phiên bản·Động cơ·Trạng thái dữ liệu | Cùng nhau xem xét các phát ngôn mang tính đại diện/ranh giới và ý định cạnh tranh |
| Ngữ nghĩa Không tìm thấy kết quả | Vector DB, Chỉ mục, Khả năng tương thích nhúng | Kiểm tra trạng thái kết nối/chỉ mục/phản ánh dữ liệu |
| LLM trả lời dao động | Nhà cung cấp, mô hình, chỉ thị, đầu vào | So sánh với cùng một bộ kiểm tra và thu hẹp các chỉ thị |
| Trạng thái học tập hoặc sẵn sàng chưa hoàn thành | Lịch sử học tập, thông báo lỗi, kết hợp lựa chọn | Ghi lại trạng thái màn hình và liên lạc với nhân viên vận hành |

Các trường hợp được thấy trong bot ML xác thực:

- Triệu chứng: Yêu cầu học tập được đăng ký trong Hàng đợi nhưng vẫn là `Chưa huấn luyện` sau khi làm mới
- Kết quả mô phỏng: `Ý định chưa phân loại`, `Không thể phân loại ý định vì không có câu huấn luyện.`
- Phán quyết: Việc lưu câu huấn luyện thành công và hoàn thành huấn luyện ML là các trạng thái riêng biệt nên chất lượng phân loại không được đánh giá trước khi huấn luyện hoàn tất.
- Hành động: Kiểm tra trạng thái hoàn thành của lịch sử học tập và nếu không có lịch sử, hãy gửi bot, phiên bản, công cụ và thời gian yêu cầu cho người quản lý vận hành.

Không điều chỉnh trạng thái bằng cách sửa đổi trực tiếp DB hoặc CLI. Bot, phiên bản, động cơ, thông báo lỗi và thời gian xuất hiện trên màn hình đều được ghi lại và gửi đến người quản lý vận hành.

## 11. Thực thi học/lập chỉ mục và đánh giá trạng thái

- Trước khi chạy, xác nhận UUID bot, phiên bản, ngôn ngữ, engine, mô hình, phương thức trả lời, tài sản đã lưu và bộ kiểm thử chuẩn.
- Học ML và lập chỉ mục Semantic có thể mất hơn ba phút. Chỉ có thông báo yêu cầu không chứng minh thành công.
- Kiểm tra trạng thái cuối trong lịch sử học rồi mới chạy Kiểm thử bot. Không có lịch sử, vẫn chưa học, chỉ mục rỗng hoặc gọi LLM thất bại đều là lỗi.

## 12. Vận hành Score và Cut-off

1. Ghi lại tiêu chí Cut-off và độ tương tự hiện tại.
2. Thu thập phân bố Score cho phát ngôn đúng, sai, ranh giới và không được hỗ trợ.
3. Mỗi lần chỉ thay đổi một tiêu chí và chạy lại cùng bộ hồi quy.
4. Đánh giá cả chấp nhận sai và từ chối sai; không chỉ tối ưu tỷ lệ hiển thị.

## 13. Vận hành NLU đa ngôn ngữ

CGA hỗ trợ tiếng Hàn, Anh, Trung giản thể, Nhật, Việt, Pháp và Đức cho giao diện và ngôn ngữ bot. Định danh và hợp đồng API giữ giá trị chuẩn; phát ngôn, thông báo, thực thể và bộ đánh giá được soạn bằng ngôn ngữ đích.

Tra cứu thông báo ưu tiên ngôn ngữ yêu cầu, nếu không có thì dùng ngôn ngữ bot. Hãy kiểm tra riêng hình thái, khoảng trắng, kính ngữ, dấu và biến thể đặc thù; không chỉ dựa vào dịch từng chữ.

## 14. Thử nghiệm engine có kiểm soát

- Tạo phiên bản làm việc riêng thay vì ghi đè phiên bản vận hành.
- Cố định bộ kiểm thử và mỗi thử nghiệm chỉ thay đổi dữ liệu, ngưỡng, mô hình, Provider, Prompt hoặc chỉ mục.
- Ghi lại độ chính xác, loại lỗi, tính nhất quán, độ trễ, chi phí và hạn chế vận hành.
- Chỉ đưa vào vận hành phiên bản đạt tiêu chí và giữ được các trường hợp thành công trước đó.

## 15. Ví dụ cải thiện chất lượng

Với câu hỏi giao hàng, tách lịch giao và trạng thái hiện tại, chuẩn bị phát ngôn đại diện, biến thể, ranh giới, ngoại lệ và hồi quy, rồi xác nhận trích xuất mã đơn hàng. Sau học hoặc lập chỉ mục, so sánh lại toàn bộ; giảm số lỗi chưa đủ nếu phát ngôn từng thành công bị giảm Score hoặc đổi ý định.

## 16. Danh sách kiểm tra đưa vào vận hành

- [ ] Đã ghi UUID bot, phiên bản, ngôn ngữ, engine, mô hình và phương thức trả lời.
- [ ] Đã so sánh trước/sau bằng cùng bộ kiểm thử.
- [ ] Đã xác nhận học hoặc lập chỉ mục thành công trong lịch sử.
- [ ] Đã xem Score, xung đột ý định tương tự và phát ngôn hồi quy.
- [ ] Đã kiểm tra thông báo và trích xuất thực thể bằng ngôn ngữ đích.
- [ ] Đã kiểm tra kênh thật và lịch sử hội thoại, API, Queue.

## Tài liệu liên quan

- [Xem tất cả hướng dẫn sử dụng CGA](../README.md)
- [Bắt đầu CGA](../cga-getting-started/README.md)
- [Hướng dẫn sử dụng CGA](../cga-user-manual/README.md)
- [Bảng so sánh động cơ](engine-comparison.md)
