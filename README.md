# fx-580VN X — bản mô phỏng trên web

Ứng dụng chạy trực tiếp trong trình duyệt, có bản HTML dùng ngoại tuyến. Đây là dự án mô phỏng **đang được phát triển và đối chiếu với máy thật**; không cam kết tương đương 100% với thiết bị Casio. Hãy kiểm tra lại bằng máy thật khi dùng kết quả cho việc quan trọng.

## Chạy ứng dụng

- Trực tuyến: [bản GitHub Pages](https://tikz-physics.github.io/casio-fx580vnx/).
- Trên máy: mở `index.html` bằng trình duyệt. Trên Windows có thể chạy `Chay_May_Tinh_Casio.bat` để mở bản `Casio_fx-580VN_X.html` ở chế độ cửa sổ ứng dụng (nếu trình duyệt hỗ trợ).
- Khi phát triển: trong thư mục dự án chạy `python3 -m http.server 8765`, sau đó mở `http://localhost:8765/`.
- Trên iPhone/iPad: mở URL bằng Safari, chọn **Chia sẻ → Thêm vào Màn hình chính**. Khả năng sử dụng ngoại tuyến phụ thuộc vào cách mở và bộ nhớ đệm của trình duyệt; dự án hiện chưa đăng ký service worker.

## Sử dụng nhanh

- `MENU → 1`: tính toán thông thường; `MENU → 5`: Vector.
- Trong Vector, chọn `VctA`–`VctD`, chọn 2 hoặc 3 chiều rồi nhập lần lượt từng tọa độ bằng `=`. Bấm `AC` để sang vùng tính toán, `OPTN` để chọn vector hoặc toán tử; `▼` khi menu `OPTN` mở để xem trang tiếp.
- `SHIFT + ∫dx`: mẫu đạo hàm; `∫dx`: mẫu tích phân xác định. `SHIFT + CALC`: SOLVE.
- `OPTN` phụ thuộc vào chế độ hiện tại. Các chi tiết hiển thị và phím bấm cần tiếp tục đối chiếu với fx-580VN X thật.

## Kiểm thử

Yêu cầu Node.js có sẵn `node:test` (khuyến nghị Node 20+). Không cần cài dependency:

```sh
node --test tests/*.test.mjs
```

Bộ kiểm thử hiện có bao phủ đạo hàm số, tích phân xác định, nhập mẫu tích phân, SOLVE, Vector 2D/3D (tạo và tính toán, OPTN, VctAns, lỗi chiều), menu OPTN thông thường và kiểm tra hai file HTML đồng bộ. Đây là **regression test**, không phải chứng nhận độ chính xác của mọi chế độ. Các trường hợp chưa tự động hóa cần so sánh trực tiếp với máy thật: thao tác đầy đủ bằng phím, menu nhiều trang, kết quả hiển thị và hình ảnh LCD.

## Cấu trúc nguồn

- `index.html`: trang web chính.
- `Casio_fx-580VN_X.html`: bản HTML dành cho lối mở ngoại tuyến/Windows; cần đồng bộ với `index.html`.
- `tests/calculator.test.mjs`: bộ test không phụ thuộc thư viện bên ngoài.
- `manifest.json`, `icons/`: metadata và biểu tượng cài đặt màn hình chính.
- `fonts/`: phông chữ và thông tin giấy phép đi kèm.
- `Chay_May_Tinh_Casio.bat`, `Chia_Se_Cho_iPad_iPhone.bat`: tiện ích Windows; không cần thiết khi dùng trang web.

Lưu ý: đây là dự án cộng đồng, không phải sản phẩm chính thức của Casio.
