# Triển khai iPaper cho khách hàng mới

## Chuẩn bị (5 phút)

1. **VPS Ubuntu 22.04**, 2vCPU/4GB RAM, trống (chưa cài web khác)
2. **Domain** (vd `ipaper.congtyban.vn`) + đã trỏ DNS A record về IP VPS
3. **GitHub Personal Access Token** (đọc repo iPaper) — https://github.com/settings/tokens

## Deploy (10 phút)

SSH vào VPS rồi chạy:

```bash
# 1. Cài Docker (nếu chưa có)
curl -fsSL https://get.docker.com | sh

# 2. Clone code (dùng token)
git clone https://<TOKEN>@github.com/khanhbinhsua/ipaper.git ~/ipaper
cd ~/ipaper

# 3. Chạy script tự động (có 2 cách)

# Cách A — Interactive (script hỏi từng bước)
chmod +x deploy/new-customer.sh
./deploy/new-customer.sh

# Cách B — Truyền tham số (nhanh hơn, không hỏi)
./deploy/new-customer.sh \
  --domain ipaper.congtyban.vn \
  --tenant congtyban \
  --tenant-name "Công ty Bạn Anh" \
  --admin-email admin@congtyban.vn \
  --brand-color "#005BAA"
```

Script sẽ:
- Tự generate mật khẩu DB/MinIO/JWT mạnh
- Thay màu brand (nếu khác đỏ mặc định)
- Build + chạy Postgres, Redis, MinIO, Backend, Frontend, Caddy
- Caddy tự xin HTTPS Let's Encrypt
- Tạo tổ chức + admin
- Xuất thông tin đăng nhập vào `~/ipaper-credentials-<tenant>.txt`

## Push Notification (tùy chọn — làm sau)

Push chỉ cần khi muốn thông báo đẩy xuống điện thoại khi app đóng. Nếu chưa cần, Socket.IO vẫn hoạt động khi app mở — giao việc / phối hợp vẫn nhận realtime.

Khi muốn bật:
1. Tạo Firebase project tại https://console.firebase.google.com
2. Add Web app → copy `firebaseConfig` → sửa `frontend/src/lib/firebase.ts`
3. Project Settings → Cloud Messaging → Generate VAPID key → thay `VAPID_PUBLIC_KEY` trong cùng file + `frontend/public/firebase-messaging-sw.js`
4. Project Settings → Service accounts → Generate private key → tải JSON → đặt tên `firebase-admin.json` → copy vào `~/ipaper/backend/firebase-admin.json`
5. Rebuild: `docker compose -f docker-compose.standalone.yml --env-file .env.prod up -d --build`

## Backup định kỳ

Nên setup cron backup DB hằng ngày:

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * docker exec ipaper_postgres pg_dump -U ipaper ipaper | gzip > ~/backup_\$(date +\%F).sql.gz") | crontab -
```

## Vận hành

```bash
cd ~/ipaper
alias dc='docker compose -f docker-compose.standalone.yml --env-file .env.prod'

dc ps              # Xem container nào đang chạy
dc logs backend -f # Xem log backend
dc restart         # Khởi động lại toàn bộ
git pull && dc up -d --build  # Cập nhật code mới
```

## Khi gặp sự cố

- **Caddy không xin được SSL**: kiểm tra DNS (`dig +short <domain>`) đã trỏ IP VPS chưa, cổng 80/443 có bị firewall chặn không
- **Push notification không đến**: xem `deploy/` cho hướng dẫn chi tiết + tài liệu Word
