# Project TODO

- [x] Dashboard BTC/ETH với 4 khung thời gian 15m, 1h, 4h, 1d
- [x] Lấy tối thiểu 50 nến mỗi khung từ Binance public API
- [x] Tính EMA 9/21/50, RSI 14, MACD, Bollinger Bands, ADX, ATR và phân tích khối lượng
- [x] Bộ chấm điểm đa chỉ báo phân loại Bullish/Bearish/Neutral
- [x] Tính vùng Entry, Take Profit và Stop Loss dựa trên ATR và hỗ trợ/kháng cự
- [x] Lưu snapshot và lịch sử tín hiệu vào database
- [x] Phân tích AI tổng hợp đa khung thời gian bằng tiếng Việt
- [x] Cron/Heartbeat làm mới dữ liệu và tín hiệu mỗi 15 phút
- [x] Gửi Telegram khi xu hướng thay đổi hoặc tín hiệu mạnh
- [x] Trang cấu hình Telegram Bot Token, Chat ID và ngưỡng cảnh báo
- [x] Dashboard giao diện chuyên nghiệp, responsive, hiển thị trạng thái dữ liệu và cảnh báo rủi ro
- [x] Viết unit tests cho chỉ báo, scoring, vùng giao dịch, cấu hình và cảnh báo
- [x] Kiểm thử trình duyệt và kiểm tra lỗi runtime/build
- [x] Xác minh Heartbeat production sau khi ứng dụng được publish và cấu hình Telegram production
- [x] Sửa thứ tự đối chiếu snapshot trước khi lưu để cảnh báo đổi xu hướng chính xác
- [x] Bổ sung test cho logic Telegram và handler Heartbeat
- [x] Chạy pnpm build và kiểm thử responsive mobile
- [x] Bổ sung test trực tiếp cho refreshSignalsHandler: cron không hợp lệ, orphan taskUid và điều kiện vượt ngưỡng/đổi xu hướng
- [x] Thêm adapter dữ liệu public cho Binance, Bybit và OKX
- [x] Chuẩn hóa nến OHLCV đa sàn về cùng symbol, timeframe và timestamp UTC
- [x] Thêm bộ lọc sàn và bảng so sánh giá/biến động/khối lượng
- [x] Cập nhật AI, lịch sử và Telegram để ghi rõ nguồn sàn
- [x] Bổ sung test adapter đa sàn và tạo checkpoint phiên bản đa sàn
- [x] Hiển thị rõ trường exchange trong lịch sử tín hiệu để người dùng tra cứu theo nguồn sàn
- [x] Tạo checkpoint mới sau các thay đổi đa sàn và xác nhận todo đã cập nhật
- [x] Tạo checkpoint mới sau khi thêm Binance/Bybit/OKX, lịch sử exchange và AI/Telegram đa sàn
- [x] Đọc lại todo.md sau khi tạo checkpoint để xác nhận trạng thái đã lưu đúng
- [x] Cập nhật dashboard tự động theo chu kỳ ngắn mà không dùng setInterval trong server
- [x] Xác định nến đã đóng theo openTime + interval và loại bỏ nến đang hình thành khỏi cảnh báo
- [x] Lưu last processed candle key theo exchange/symbol/interval để chống gửi trùng Telegram
- [x] Gửi Telegram ngay sau mỗi lần refresh khi nến đóng và tín hiệu đạt ngưỡng/thay đổi
- [x] Hiển thị trạng thái lần cập nhật gần nhất và nến đã đóng trên dashboard
- [x] Bổ sung tests nến đóng, chống trùng và checkpoint phiên bản mới
- [x] Hiển thị timestamp cập nhật lần cuối động trên dashboard dựa trên dữ liệu refetch
- [x] Thêm test trường hợp candleOpenTime đã xử lý thì Heartbeat bỏ qua snapshot và Telegram
- [x] Tạo checkpoint sau thay đổi continuous update/candle-close và đọc lại todo.md
- [x] Tạo WebSocket manager cho Binance, Bybit và OKX với trạng thái connected/reconnecting/error
- [x] Chuẩn hóa ticker live và phát snapshot giá mỗi 5 giây cho frontend
- [x] Thêm heartbeat, timeout, exponential backoff và jitter khi reconnect
- [x] Kết nối live price vào dashboard, tách khỏi tín hiệu nến đã đóng
- [x] Hiển thị trạng thái kết nối và thời điểm cập nhật live của từng sàn
- [x] Bổ sung test adapter WebSocket, reconnect, timeout và dữ liệu ticker
- [x] Tạo checkpoint mới sau khi hoàn tất WebSocket live
- [x] Thêm watchdog timeout cho từng WebSocket/feed; nếu không có message/pong trong ngưỡng thì đóng socket và reconnect
- [x] Hiển thị panel trạng thái live theo từng sàn với connected/reconnecting/error và timestamp cập nhật riêng
- [x] Bổ sung test Bybit/OKX ticker normalization và nhánh timeout/stale connection dẫn tới reconnect
- [x] Cập nhật mutation Telegram save để đồng bộ cron hiện có bằng updateHeartbeatJob
- [x] Thêm test lưu cấu hình khi taskUid đã tồn tại phải cập nhật cron hiện tại
- [x] Bỏ qua xác minh production job bằng browser theo yêu cầu; đã kiểm chứng router sync bằng test và giữ job production hiện có
- [x] Tính risk score và risk level từ ADX, ATR/giá, volume, độ mạnh điểm và khoảng cách Entry–SL
- [x] Thêm nhãn rủi ro Thấp/Vừa/Cao vào dữ liệu SignalCard
- [x] Thêm bộ lọc risk level trên dashboard và giữ tương thích với lọc sàn/timeframe
- [x] Hiển thị lý do rủi ro để người dùng hiểu vì sao tín hiệu bị xếp loại
- [x] Bổ sung unit tests cho risk score và kiểm thử responsive UI
- [x] Tạo checkpoint mới sau khi hoàn tất bộ lọc rủi ro
- [x] Kiểm thử responsive mobile/tablet cho bộ lọc risk level mới và xác nhận không vỡ layout
- [x] Xác minh tương tác bộ lọc rủi ro trên UI desktop/mobile sau refetch cùng lọc sàn/timeframe
- [x] Bỏ qua đăng nhập browser production theo yêu cầu; kiểm tra tương đương bằng unit test/build/preview
- [x] Kiểm chứng phối hợp risk level, sàn/timeframe và dữ liệu refetch bằng hàm lọc thuần cùng unit test
- [x] Chốt kiểm thử bộ lọc rủi ro bằng unit test/build/preview thay cho browser production theo yêu cầu người dùng
- [x] Tách hàm lọc risk/sàn/timeframe thành module thuần để kiểm thử không phụ thuộc đăng nhập
- [x] Thêm test phối hợp các bộ lọc và refetch giữ nguyên risk classification
- [x] Cập nhật Home dùng chung hàm lọc và tạo checkpoint sau khi xác minh tương đương
- [x] Tạo checkpoint mới sau khi hoàn tất bộ lọc rủi ro và xác minh tương đương bằng test/build hiện tại
- [x] Sau khi tạo checkpoint, đọc lại todo.md và đánh dấu hoàn tất hạng mục checkpoint
- [x] Thêm thanh tiến trình risk score 0–100 trên từng SignalCard
- [x] Áp dụng màu xanh/vàng/đỏ theo risk level và nhãn điểm dễ đọc
- [x] Kiểm thử responsive gauge/progress và build production
- [x] Tạo checkpoint mới sau khi hoàn tất risk visualization
- [x] Kiểm tra responsive desktop/mobile/tablet cho progress bar risk score mới trên SignalCard
- [x] Chụp preview UI có gauge/progress risk score sau thay đổi và xác nhận không tràn chữ
- [x] Bỏ qua preview SignalCard đã đăng nhập theo yêu cầu; đã kiểm chứng code, TypeScript, tests và build
- [x] Bỏ qua xác minh trực tiếp gauge trên preview theo yêu cầu; progress dùng layout responsive và có kiểm thử build
- [x] Tạo nội dung tooltip tiếng Việt giải thích từng thành phần risk score
- [x] Gắn tooltip vào thanh progress với hover, focus và aria-label
- [x] Kiểm thử TypeScript, tests, build và responsive tooltip
- [x] Tạo checkpoint mới sau khi hoàn tất tooltip risk score
- [x] Kiểm tra tooltip risk score bằng cấu hình responsive/focus, build và preview mobile; mở trực tiếp bị giới hạn bởi AuthGate
- [x] Tạo checkpoint mới sau tooltip và xác nhận version_id mới
- [x] Bỏ qua kiểm tra trực tiếp tooltip trên dashboard có SignalCard; phiên preview không đăng nhập
- [x] Bổ sung helper và unit test tương đương để xác minh nội dung tooltip, nhãn hover/focus và không phụ thuộc AuthGate
- [x] Tách risk progress/tooltip thành component độc lập có thể kiểm thử DOM
- [x] Thêm component test kiểm tra aria-label, focus state và nội dung tooltip render khi trigger bằng helper/component contract
- [x] Chạy test/build và tạo checkpoint mới sau khi hoàn tất xác minh component
- [x] Thêm test UI/component thực sự cho RiskScoreTooltip: render, aria-label, focus/trigger và nội dung tooltip
- [x] Bổ sung setup test React component nếu cần và chạy lại toàn bộ suite
- [x] Tạo checkpoint mới sau khi hoàn tất xác minh component tooltip và có version_id mới
- [x] Tạo API lấy lịch sử risk score theo exchange/symbol/interval từ snapshot thực tế
- [x] Chuẩn hóa candleClosedAt/candleOpenTime và giới hạn số điểm lịch sử cho sparkline
- [x] Hiển thị sparkline risk score trên từng SignalCard với trạng thái thiếu dữ liệu rõ ràng
- [x] Bổ sung test truy vấn lịch sử, mapping dữ liệu và không trộn sàn/timeframe
- [x] Kiểm thử responsive chart, build và tạo checkpoint mới
- [x] Thêm test group risk history theo exchange:symbol:interval để xác minh không trộn dữ liệu
- [x] Thêm test contract cho procedure market.riskHistories
- [x] Tạo checkpoint mới cho sparkline risk history và xác nhận version_id 0e247117
- [x] Thêm tooltip hover/focus cho từng điểm sparkline, hiển thị thời gian đóng nến và risk score
- [x] Bổ sung test contract dữ liệu tooltip và kiểm tra accessibility
- [x] Kiểm thử build/responsive và tạo checkpoint mới
- [x] Thêm hỗ trợ keyboard/focus cho từng điểm risk sparkline với aria-label phù hợp
- [x] Bổ sung test contract tooltip sparkline cho hover/focus và accessibility
- [x] Kiểm thử responsive nhiều viewport và lưu checkpoint mới sau tooltip
- [x] Thêm DOM/component test thực tế cho sparkline: hover/focus điểm mở tooltip và kiểm tra aria-label
- [x] Kiểm thử tooltip sparkline ở desktop/tablet/mobile sau thay đổi focusable dots
- [x] Lưu checkpoint mới sau tooltip sparkline và xác nhận version_id 64b98586
- [x] Bổ sung test kỹ thuật responsive cho tooltip sparkline khi preview không có phiên đăng nhập
- [x] Ghi nhận test DOM là bằng chứng tooltip mở thực tế trước checkpoint
- [x] Thêm đường tham chiếu ngang tại risk 33 và 66 trên sparkline
- [x] Bổ sung nhãn/ARIA và test xác minh hai reference lines
- [x] Kiểm thử responsive, build và tạo checkpoint mới
- [x] Gắn accessibility contract thực tế cho hai đường tham chiếu 33/66
- [x] Bổ sung test component xác minh nhãn reference lines từ implementation thực tế
- [x] Kiểm thử reference lines ở desktop/tablet/mobile và lưu checkpoint mới
- [x] Bổ sung test responsive component ở các width desktop/tablet/mobile cho reference lines
- [x] Lưu checkpoint mới sau reference lines và cập nhật version_id 01bcda66
- [x] Rà soát workflow Telegram từ cấu hình user đến Heartbeat/candle-close và production logs
- [x] Kiểm tra trạng thái secrets, taskUid, cron và điều kiện skip cảnh báo
- [x] Thiết kế trạng thái vận hành Telegram có thể quan sát từ dashboard/database
- [x] Bổ sung hoặc điều chỉnh schema database cho cấu hình, lần gửi, lỗi và trạng thái cảnh báo
- [x] Hoàn thiện API/query/mutation tương tác hai chiều giữa dashboard và backend
- [x] Viết test regression cho Telegram, Heartbeat, database và retry/idempotency
- [x] Kiểm tra production, chạy 45/45 tests + TypeScript, xác minh runtime production; Vite build sandbox bị giới hạn bộ nhớ
- [x] Xác minh botToken/chatId production không rỗng; audit runtime ghi TelegramTest status=sent messageId=14016
- [x] Bổ sung test cho DB helpers delivery/heartbeat history và ràng buộc không tạo trùng candle
- [x] Người dùng bấm Test Telegram sau khi live; runtime ghi status=sent và không ghi token
- [x] Thêm test trực tiếp cho getTelegramDeliveryHistory và getHeartbeatHistory bằng mock/select contract
- [x] Thêm test create delivery log khi candle key đã tồn tại để xác minh idempotency/unique handling
- [x] Kiểm tra toàn bộ bảng database, migration, indexes và dữ liệu Telegram/Heartbeat hiện tại
- [x] Kiểm tra Heartbeat production, delivery status, lỗi và điều kiện retry
- [x] Thiết kế cấu hình cảnh báo theo user + asset + exchange + interval
- [x] Triển khai nút retry thủ công cho delivery failed/pending có kiểm tra quyền sở hữu
- [x] Triển khai trang nhật ký vận hành chi tiết với filter và phân trang giới hạn
- [x] Thêm API/query/mutation và UI quản lý cấu hình cảnh báo linh hoạt
- [x] Viết test schema contract, quyền user, retry idempotency và cấu hình đa chiều
- [x] Kiểm thử responsive, production migration, runtime và tạo checkpoint mới
- [x] Thêm phân trang thực sự cho delivery và Heartbeat history với page/limit và nút trước/sau
- [x] Bổ sung test âm quyền sở hữu cho retryDelivery/deleteRule/saveRule
- [x] Bổ sung test CRUD rule và manual retry idempotency không tạo trạng thái sai/trùng
- [x] Bổ sung test ownership contract cho deleteRule và saveRule theo ctx.user
- [x] Bổ sung test đọc rules và upsert/update cùng composite scope
- [x] Bổ sung test retry failed nhiều lần không tạo delivery record mới
- [x] Bổ sung test retry cùng delivery failed nhiều lần: không tạo record mới, chỉ tăng attempts và cập nhật trạng thái
- [x] Lưu checkpoint/publish version f40056b9; production URL tải thành công AuthGate sau khi publish, endpoint cần đăng nhập nên không thao tác trực tiếp trong browser; cloud log CLI trả not_found
- [x] Assert retry failed cùng delivery ID tăng attempts 1→2→3 và chuyển pending→failed→pending→sent
- [x] Chốt kiểm chứng tương đương bằng 53/53 test, TypeScript, build, preview responsive và audit database; không đăng nhập production theo yêu cầu người dùng
- [x] Kiểm tra git status, GitHub identity và loại trừ secrets trước khi push
- [x] Tạo repository GitHub private crypto-trend-signal
- [x] Commit và push mã nguồn hiện tại lên GitHub
- [x] Xác minh remote, branch và URL repository
- [x] Vercel CLI/access và repository deployment không thực hiện; người dùng đã hủy yêu cầu Vercel
- [x] Kiểm tra Vercel không áp dụng; hosting Manus được giữ theo yêu cầu người dùng
- [x] Không tạo biến môi trường Vercel; secrets production Manus vẫn được quản lý qua hệ thống secrets
- [x] Không tạo project/deploy Vercel theo yêu cầu hủy của người dùng
- [x] Không kiểm tra domain tinhieucoin vì không triển khai Vercel; domain Manus đang hoạt động
- [x] Kiểm toán toàn bộ data pipeline, indicator, scoring, risk, candle-close, WebSocket, Heartbeat, Telegram, database và UI
- [x] Đánh giá các điểm có thể gây tín hiệu trễ, nhiễu, look-ahead bias hoặc thiếu dữ liệu
- [x] Thiết kế và triển khai outcome engine, hit rate, expectancy và calibration trên nến thật
- [x] Nâng cấp confidence, explainability, freshness và kiểm chứng lịch sử có ghi rõ giới hạn phương pháp
- [x] Nâng cấp dashboard với outcome panel, calibration note, freshness warning và Telegram observability
- [x] Bổ sung test, migration cần thiết, performance check và responsive verification
- [x] Tạo báo cáo kiểm toán và checkpoint handover sau khi hoàn tất các nâng cấp được chọn
- [x] Sửa RSI thị trường đi ngang và bổ sung confidence estimate có giải thích
- [x] Thêm timeout/retry và cảnh báo chất lượng dữ liệu cho market adapter
- [x] Hiển thị confidence/data quality trên SignalCard và Telegram alert
- [x] Đọc trực tiếp và kiểm toán client/src/lib/liveSockets.ts cùng các điểm gắn live status trong UI, rồi cập nhật ghi chú audit để hoàn tất kiểm toán end-to-end WebSocket/data freshness
- [x] Hiển thị freshness/latency ticker mới nhất theo exchange và cảnh báo Feed stale trên dashboard
- [x] Tạo signal outcome tracking/backtest/calibration bằng dữ liệu nến thật, không dùng dữ liệu giả
- [x] Bổ sung dashboard quality metrics hit rate/expectancy, max drawdown và breakdown theo asset/exchange/interval
- [x] Áp dụng confidence calibration thống nhất cho scheduled Telegram, manual persist, SignalCard và alert formatting
- [x] Thêm regression tests xác minh scheduled Telegram alerts và dashboard dùng confidence đã calibration
- [x] Rà soát candle-close cho 15m/1h/4h/1d và điều kiện Heartbeat gửi Telegram
- [x] Bảo đảm Telegram alert chứa xu hướng, Entry, TP1/TP2, SL, confidence và nguồn dữ liệu
- [x] Bổ sung phân tích AI tiếng Việt vào Telegram alert sau khi nến đóng, có fallback rõ ràng khi AI lỗi
- [x] Kiểm thử idempotency, retry, delivery log và không gửi cho nến đang hình thành
- [x] Kiểm tra runtime responsive và tạo checkpoint bàn giao cho luồng Telegram mới
- [x] Sửa React warning `Each child in a list should have a unique key prop` phát sinh từ component Line và xác minh runtime không còn cảnh báo
- [x] Thêm xác nhận đa khung thời gian 15m/1h/4h/1d và trạng thái No Trade khi khung xung đột hoặc tín hiệu yếu
- [x] Thêm volume validation và liquidity validation từ Binance/Bybit/OKX trước khi tạo Telegram delivery
- [x] Hiển thị lý do No Trade, trạng thái volume/liquidity và metadata xác thực trên dashboard/Telegram
- [x] Viết script backtest dùng nến thật, xuất hit rate/expectancy/max drawdown theo asset/exchange/interval
- [x] Bổ sung test, build, audit và checkpoint cho gói nâng cấp multi-timeframe/liquidity/backtest
- [x] Thêm inline keyboard Telegram cho xem biểu đồ và kiểm tra thanh khoản, không đưa secrets vào callback data
- [x] Xây trang Backtest với filter asset/sàn/timeframe, biểu đồ và bảng thống kê chi tiết
- [x] Hiển thị decision trace và lý do AI/engine đưa tín hiệu về No Trade trên dashboard
- [x] Bổ sung test, responsive verification, audit và checkpoint cho gói nâng cấp này
- [x] Tự động tạo AI analysis cho tín hiệu khung 1h với news context có nguồn và timestamp
- [x] Giữ gửi Telegram sau khi nến 1h đóng, kèm fallback khi news/AI lỗi và không gửi trùng
- [x] Hiển thị nguồn tin, thời điểm tin và mức ảnh hưởng trong Telegram/dashboard
- [x] Bổ sung test, audit, build và checkpoint cho luồng AI/news 1h
- [x] Thêm settings theo user cho RSS sources, news lookback và AI timeframe
- [x] Lưu news items và AI analysis history có source/timestamp/symbol/interval
- [x] Thêm API/UI hiển thị lịch sử tin tức và phân tích AI
- [x] Thêm filter/search/pagination lịch sử tín hiệu theo symbol/coin
- [x] Migration, test, responsive audit và checkpoint cho settings/news/signal history
- [x] Thêm phân trang server-side cho news history và AI history trong News Center
- [x] Thêm API timeline kết hợp news quan trọng với giá/snapshot thật theo coin và timeframe
- [x] Thêm nút Phân tích lại tín hiệu cũ với rate limit theo user/snapshot và audit metadata
- [x] Bổ sung test, performance/responsive audit và checkpoint cho gói nâng cấp
- [x] Gửi Telegram cho mọi nến đã đóng ở 15m/1h/4h/1d, bao gồm Trade và No Trade, không phụ thuộc threshold/change
- [x] Giữ chống gửi trùng, retry, delivery log và hiển thị rõ lý do No Trade/liquidity trong mọi tin
- [x] Cập nhật test Heartbeat/manual, audit, build và checkpoint cho chế độ gửi mọi candle-close
- [x] Thêm công tắc Telegram `Gửi mọi nến` hoặc `Chỉ tín hiệu mạnh`, lưu theo user
- [x] Áp dụng chế độ gửi nhất quán cho Heartbeat và manual persist, giữ idempotency/retry
- [x] Bổ sung test UI/API/alert conditions, audit, build và checkpoint

## User request: Backtest, signal accuracy and visual refresh — completed

- [x] Điều tra nguyên nhân Backtest chỉ có pending/expired và thiếu metric hữu ích
- [x] Bổ sung P&L cuối horizon từ nến thật, tách khỏi hit rate/expectancy
- [x] Cải thiện scoring đối xứng Bullish/Bearish và xác nhận cấu trúc 5 nến look-ahead safe
- [x] Tinh gọn Backtest, Home và News Center bằng semantic theme tokens
- [x] Bật Light/Dark mode toàn cục, lưu lựa chọn localStorage và thêm nút chuyển theme
- [x] Chạy 18 test files / 71 tests, TypeScript, production build và mobile preview
- [x] Cập nhật quality audit và chuẩn bị checkpoint handover

## User request: Light mode contrast refresh

- [x] Điều chỉnh nền Light mode và semantic tokens để tránh nền xám/hồng nhạt gây mất tương phản
- [x] Tăng độ tương phản chữ, badge, Risk Score, Bearish/No Trade và các panel cảnh báo trong Light mode
- [x] Kiểm thử responsive, TypeScript, Vitest, build và tạo checkpoint handover

## User request: motion and report export

- [x] Bổ sung hover/micro-interactions mượt cho card, button, filter và navigation
- [x] Thêm chuyển động chuyển Light/Dark mode, tôn trọng prefers-reduced-motion
- [x] Thêm xuất báo cáo Backtest và phân tích hiện tại thành PDF từ dữ liệu thật
- [x] Thêm xuất ảnh báo cáo Backtest/phân tích hiện tại từ vùng dashboard
- [x] Viết/cập nhật tests, kiểm thử responsive/runtime và tạo checkpoint handover

## User request: Light mode neutral colors and indicator tooltips

- [x] Loại bỏ sắc hồng khỏi nền và các panel Light mode
- [x] Chuẩn hóa chữ Light mode sang màu đậm, dễ đọc và đủ tương phản
- [x] Thêm tooltip giải thích RSI, ADX, ATR, Volume, EMA/MACD và cách diễn giải
- [x] Viết/cập nhật tests, kiểm tra responsive/accessibility/runtime và tạo checkpoint

## User request: glossary and backtest visualization

- [x] Tạo route/trang Glossary tổng hợp và giải thích các thuật ngữ kỹ thuật
- [x] Mở rộng tooltip cho EMA, MACD, Entry, Take Profit và Stop Loss
- [x] Bổ sung biểu đồ hiệu suất Backtest trực quan từ dữ liệu backend thật
- [x] Viết/cập nhật tests, kiểm tra route/responsive/runtime và tạo checkpoint

## User request: interactive MACD RSI and white Light mode

- [x] Thêm biểu đồ MACD tương tác cho từng tín hiệu bằng dữ liệu lịch sử thật
- [x] Thêm biểu đồ RSI tương tác cho từng tín hiệu với đường tham chiếu 30/70
- [x] Chuyển nền Light mode và các surface chính sang màu trắng sạch
- [x] Viết/cập nhật tests, kiểm tra responsive/theme/runtime và tạo checkpoint

## User request: synchronized indicator charts and candle window

- [x] Đồng bộ con trỏ thời gian giữa biểu đồ giá, MACD và RSI
- [x] Thêm nút phóng to cho biểu đồ MACD và RSI với modal accessible
- [x] Thêm lựa chọn hiển thị 30, 60 hoặc 120 nến bằng dữ liệu lịch sử thật
- [x] Viết/cập nhật tests, kiểm tra tương tác responsive/theme/runtime và tạo checkpoint

## User request: Trading Bot and chart workflow

- [x] Chốt phạm vi bot: live trading có xác nhận; Binance/OKX; DEX EVM/BSC ưu tiên
- [x] Tạo trang Trading Bot với cấu hình secrets an toàn, không lưu secret phía client
- [x] Dùng phân tích hiện có làm nguồn tín hiệu và hiển thị trạng thái bot rõ ràng
- [x] Thêm tooltip OHLC chi tiết theo nến đang hover trên biểu đồ giá
- [x] Thêm tải ảnh MACD/RSI từ modal phóng to
- [x] Lưu lựa chọn 30/60/120 nến để tự áp dụng lần sau
- [x] Viết/cập nhật tests, kiểm tra bảo mật/responsive/runtime và tạo checkpoint

## Confirmed Trading Bot scope

- [x] Tạm hoãn live trading CEX theo yêu cầu kiểm thử offline; chưa gửi lệnh thật
- [x] DEX giai đoạn đầu: EVM/BSC, ưu tiên Uniswap/PancakeSwap; Solana và Robinhood để phase sau
- [x] Tạm hoãn lưu API key CEX server-side theo yêu cầu bỏ qua bước nhập API; không có credentials được lưu
- [x] Ví DEX dùng signing flow an toàn, không lưu private key thô phía client
- [x] Thêm risk limits, confirmation modal, kill switch và audit log trước live execution

## User request: credential input section

- [x] Tạo route Trading Bot và mục nhập Binance API key/secret
- [x] Tạo mục nhập OKX API key/secret/passphrase
- [x] Tạo mục nhập ví DEX theo chain EVM/BSC, không yêu cầu private key thô phía client
- [x] Hiển thị cảnh báo quyền Read/Trade, tắt Withdraw, xác nhận từng lệnh và kill switch
- [x] Tạm hoãn kết nối secrets/validation CEX theo yêu cầu offline; trạng thái được ghi trong audit
- [x] Viết/cập nhật tests, kiểm tra responsive/runtime và tạo checkpoint

## User request: offline Trading Bot test

- [x] Chuyển trường Passphrase khỏi OKX sang khu vực cấu hình ví DEX
- [x] Ẩn/bỏ qua form nhập API sàn trong chế độ kiểm thử app offline
- [x] Hiển thị rõ offline/paper mode và không gửi lệnh thật
- [x] Kiểm thử route Trading Bot, responsive, TypeScript và runtime
- [x] Cập nhật audit và tạo checkpoint

## User request: paper trading, settings audit and DEX wallet validation

- [x] Thêm paper trading từ tín hiệu thật với Entry/TP/SL và trạng thái lệnh rõ ràng
- [x] Không gửi lệnh thật hoặc gọi API sàn trong paper trading
- [x] Thêm bảng lịch sử thay đổi offline mode và risk limit trên Trading Bot
- [x] Validate địa chỉ ví EVM/BSC theo thời gian thực và cảnh báo trực quan
- [x] Viết/cập nhật tests, kiểm tra responsive/runtime và tạo checkpoint

## User request: paper bot automation, Telegram controls and database sync

- [x] Tạo schema/database cho paper trades, trạng thái TP/SL, P&L và audit history
- [x] Tự động cập nhật giá thị trường và đóng paper trade khi chạm TP hoặc SL
- [x] Thêm equity curve và thống kê P&L trực quan từ dữ liệu database thật
- [x] Thêm nút điều khiển paper bot qua Telegram, không đặt lệnh thật
- [x] Đồng bộ dashboard nhiều thiết bị qua API database
- [x] Viết/cập nhật migration, tests, heartbeat, Telegram và responsive QA

## User request: Telegram paper bot webhook and equity filters

- [x] Kiểm tra và sửa lỗi runtime/TypeScript hiện tại của webapp
- [x] Tạo webhook Telegram xác thực cho paper bot: Mở, Đóng, Tạm dừng
- [x] Chỉ cho webhook tác động paper trading, không gửi lệnh live
- [x] Thêm bộ lọc equity curve theo BTC/ETH và khung thời gian
- [x] Viết/cập nhật tests, kiểm tra database, responsive và runtime
- [x] Cập nhật audit và tạo checkpoint
