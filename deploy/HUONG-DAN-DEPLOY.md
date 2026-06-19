# Hướng dẫn Deploy iPaper lên VPS Việt Nam

## Tổng quan kiến trúc production
```
Internet
   │ HTTPS (443) — Caddy tự xin SSL Let's Encrypt
   ▼
┌─────────── Caddy (reverse proxy) ───────────┐
│  ipaper.congty.vn      → frontend + /api → backend │
│  storage.ipaper...vn   → MinIO (link tải/xem file) │
└──────────────────────────────────────────────┘
   ▼            ▼            ▼
frontend     backend ──── postgres / redis / minio
(nginx)      (NestJS)        (dữ liệu, lưu trên volume)
```
Toàn bộ chạy bằng Docker Compose. Caddy tự động cấp & gia hạn HTTPS miễn phí.

---

## BƯỚC 0 — Chuẩn bị
- 1 VPS Việt Nam (Viettel/VNG/BizFly...), khuyến nghị **2 vCPU / 4GB RAM / 40GB SSD**, OS **Ubuntu 22.04**.
- Domain đã có. Cần tạo 2 bản ghi DNS (A record) trỏ về **IP VPS**:
  | Loại | Tên | Giá trị |
  |---|---|---|
  | A | `ipaper` (hoặc subdomain anh muốn) | IP_VPS |
  | A | `storage.ipaper` | IP_VPS |

  > Ví dụ domain `congty.vn` → app ở `ipaper.congty.vn`, file ở `storage.ipaper.congty.vn`.

---

## BƯỚC 1 — Cài Docker trên VPS
SSH vào VPS rồi chạy:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Đăng xuất & SSH lại để áp dụng quyền docker
docker --version && docker compose version
```

---

## BƯỚC 2 — Đưa mã nguồn lên VPS
**Cách A — qua Git (khuyến nghị):**
```bash
git clone <URL_REPO_CUA_ANH> ipaper
cd ipaper
```
**Cách B — copy từ máy Windows:** dùng WinSCP/FileZilla copy cả thư mục `Paperless office` lên VPS (vào `~/ipaper`).

> Lưu ý: KHÔNG copy `node_modules`, `.env` (dev). `.dockerignore` đã loại sẵn khi build.

---

## BƯỚC 3 — Tạo file cấu hình `.env.prod`
```bash
cp .env.prod.example .env.prod
nano .env.prod
```
Sửa các giá trị **BẮT BUỘC**:
- `APP_DOMAIN` = `ipaper.congty.vn` (domain thật của anh)
- `STORAGE_DOMAIN` = `storage.ipaper.congty.vn`
- `FRONTEND_URL` = `https://ipaper.congty.vn`
- `MINIO_PUBLIC_ENDPOINT` = `storage.ipaper.congty.vn`
- `DB_PASS` = mật khẩu mạnh
- `MINIO_PASS` = mật khẩu mạnh
- `JWT_SECRET` = chuỗi ngẫu nhiên dài (tạo bằng: `openssl rand -hex 32`)

---

## BƯỚC 4 — Khởi động hệ thống
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
Lần đầu build mất vài phút. Kiểm tra:
```bash
docker compose -f docker-compose.prod.yml ps        # tất cả "running/healthy"
docker compose -f docker-compose.prod.yml logs -f caddy   # xem Caddy xin SSL
```
> Caddy cần cổng 80/443 mở (firewall VPS phải cho phép). DNS phải trỏ đúng IP trước khi Caddy xin được chứng chỉ.

---

## BƯỚC 5 — Tạo tài khoản admin đầu tiên
```bash
docker compose -f docker-compose.prod.yml exec \
  -e INIT_TENANT_SLUG=congty \
  -e INIT_TENANT_NAME="Công ty ABC" \
  -e INIT_ADMIN_USER=admin \
  -e INIT_ADMIN_PASS='MatKhauManh@2026' \
  -e INIT_ADMIN_EMAIL=admin@congty.vn \
  backend node dist/init.js
```
→ In ra tài khoản admin vừa tạo (script an toàn, không xóa dữ liệu, chạy lại nhiều lần không sao).

---

## BƯỚC 6 — Truy cập & kiểm tra
- Mở `https://ipaper.congty.vn`
- Đăng nhập: **Mã tổ chức** = `congty`, **Tài khoản** = `admin`, **Mật khẩu** vừa đặt
- Vào **Quản trị người dùng** → tạo tài khoản cho nhân viên, trưởng phòng, ban giám đốc
- **Đổi mật khẩu admin ngay** (menu user → Đổi mật khẩu)

---

## Vận hành thường ngày
| Việc | Lệnh |
|---|---|
| Xem log | `docker compose -f docker-compose.prod.yml logs -f backend` |
| Khởi động lại | `docker compose -f docker-compose.prod.yml restart` |
| Dừng | `docker compose -f docker-compose.prod.yml down` |
| Cập nhật code mới | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |

### Sao lưu dữ liệu (QUAN TRỌNG — chạy định kỳ)
```bash
# Backup database
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U ipaper ipaper | gzip > backup_$(date +%F).sql.gz

# Backup file đính kèm (MinIO)
docker run --rm -v ipaper_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_$(date +%F).tar.gz -C /data .
```

---

## Xử lý sự cố thường gặp
- **Caddy không xin được SSL:** kiểm tra DNS đã trỏ đúng IP chưa (`dig ipaper.congty.vn`), cổng 80/443 đã mở firewall chưa.
- **Tải/xem file lỗi:** kiểm tra `storage.<domain>` đã có DNS + truy cập `https://storage.<domain>` thấy phản hồi MinIO.
- **Backend không kết nối DB:** xem `docker compose ... logs backend`; đảm bảo `DB_HOST=postgres` (không phải localhost).
