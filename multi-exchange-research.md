# Xác minh API OHLCV đa sàn

## Binance
Tài liệu chính thức: https://developers.binance.com/en/docs/binance-spot-api-docs/rest-api/market-data-endpoints

Adapter hiện tại dùng endpoint Spot `GET https://api.binance.com/api/v3/klines` với `symbol`, `interval` và `limit`. Kết quả là mảng nến, trong đó các trường đầu gồm open time, open, high, low, close và volume.

## Bybit
Tài liệu chính thức: https://bybit-exchange.github.io/docs/v5/market/kline

Endpoint `GET /v5/market/kline` hỗ trợ `category=spot|linear|inverse`, `symbol`, `interval` và `limit` từ 1 đến 1000. Bybit trả nến theo thứ tự ngược thời gian; mỗi phần tử có startTime, openPrice, highPrice, lowPrice, closePrice, volume và turnover. Adapter phải đảo mảng trước khi phân tích.

## OKX
Tài liệu chính thức cần dùng khi triển khai: https://www.okx.com/docs-v5/en/

Cần chuẩn hóa instrument dạng `BTC-USDT`/`ETH-USDT` và quy đổi các interval 15m, 1H, 4H, 1D sang quy ước của OKX. Mọi timestamp nội bộ lưu theo Unix milliseconds UTC.

## Quy tắc hợp nhất

Mỗi bản ghi chuẩn hóa gồm exchange, symbol, interval, openTime, open, high, low, close và volume. Tín hiệu chính có thể tính riêng theo từng sàn; tín hiệu hợp nhất dùng trung vị giá và đồng thuận nhãn/điểm giữa các sàn, đồng thời hiển thị độ lệch giá và khối lượng để phát hiện chênh lệch thanh khoản.
