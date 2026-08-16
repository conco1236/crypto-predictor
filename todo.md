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
- [ ] Xác minh Heartbeat 15 phút sau khi ứng dụng được publish và cấu hình Telegram production
- [x] Sửa thứ tự đối chiếu snapshot trước khi lưu để cảnh báo đổi xu hướng chính xác
- [x] Bổ sung test cho logic Telegram và handler Heartbeat
- [x] Chạy pnpm build và kiểm thử responsive mobile
- [x] Bổ sung test trực tiếp cho refreshSignalsHandler: cron không hợp lệ, orphan taskUid và điều kiện vượt ngưỡng/đổi xu hướng
