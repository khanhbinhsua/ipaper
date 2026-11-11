#!/usr/bin/env bash
# ============================================================
#  iPaper — Setup khách hàng mới (trọn gói)
#
#  Dùng cho VPS TRỐNG (chưa có web khác chiếm cổng 80/443).
#  Tự lo: generate mật khẩu, config, build, chạy, tạo admin, SSL.
#
#  Chạy:
#    chmod +x deploy/new-customer.sh
#    ./deploy/new-customer.sh
#
#  Hoặc truyền trực tiếp:
#    ./deploy/new-customer.sh \
#      --domain ipaper.congtyban.vn \
#      --tenant congtyban --tenant-name "Công ty Bạn Anh" \
#      --admin-email admin@congtyban.vn \
#      --brand-color "#005BAA"
# ============================================================
set -euo pipefail

# ---------- màu terminal ----------
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; C='\033[0;36m'; N='\033[0m'
ok() { echo -e "${G}✓${N} $1"; }
err() { echo -e "${R}✗${N} $1" >&2; }
info() { echo -e "${C}→${N} $1"; }
ask() { echo -ne "${Y}?${N} $1: "; }

# ---------- parse arguments ----------
DOMAIN=""
TENANT_SLUG=""
TENANT_NAME=""
ADMIN_USER="admin"
ADMIN_EMAIL=""
ADMIN_PASS=""
BRAND_COLOR="#E4002B"
PROJECT_DIR="$HOME/ipaper"

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN="$2"; shift 2 ;;
    --tenant) TENANT_SLUG="$2"; shift 2 ;;
    --tenant-name) TENANT_NAME="$2"; shift 2 ;;
    --admin-user) ADMIN_USER="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --brand-color) BRAND_COLOR="$2"; shift 2 ;;
    --dir) PROJECT_DIR="$2"; shift 2 ;;
    -h|--help)
      head -20 "$0" | grep -E '^#' | sed 's/^# //'
      exit 0 ;;
    *) err "Tham số không hợp lệ: $1"; exit 1 ;;
  esac
done

# ---------- interactive prompts cho các field còn trống ----------
[ -z "$DOMAIN" ]       && { ask "Domain (vd: ipaper.congtyban.vn)";   read DOMAIN; }
[ -z "$TENANT_SLUG" ]  && { ask "Mã tổ chức (vd: congtyban)";          read TENANT_SLUG; }
[ -z "$TENANT_NAME" ]  && { ask "Tên tổ chức (vd: Công ty Bạn Anh)";   read TENANT_NAME; }
[ -z "$ADMIN_EMAIL" ]  && { ask "Email admin";                         read ADMIN_EMAIL; }

# ---------- validate ----------
# Nhận IP (127.0.0.1), domain (abc.vn), hoặc sslip.io style (1.2.3.4.sslip.io)
IS_IP_ONLY=0
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IS_IP_ONLY=1
  info "⚠ Dùng IP thuần → sẽ chạy HTTP (không HTTPS). PWA + Push notification sẽ KHÔNG hoạt động."
  info "  Khuyên dùng miễn phí: ipaper.${DOMAIN//./-}.sslip.io  (tự map về IP $DOMAIN, có HTTPS)"
elif [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  err "Domain/IP không hợp lệ: $DOMAIN"; exit 1
fi
[[ "$TENANT_SLUG" =~ ^[a-zA-Z0-9]+$ ]]             || { err "Mã tổ chức chỉ dùng chữ+số, không dấu"; exit 1; }
[[ "$BRAND_COLOR" =~ ^#[0-9A-Fa-f]{6}$ ]]          || { err "Màu brand phải dạng #RRGGBB"; exit 1; }

# ---------- generate credentials ----------
# Mật khẩu thuần chữ-số 20 ký tự (tránh ký tự đặc biệt gây lệch env parsing)
rnd() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

DB_PASS=$(rnd 24)
MINIO_PASS=$(rnd 24)
JWT_SECRET=$(openssl rand -hex 32)
[ -z "$ADMIN_PASS" ] && ADMIN_PASS="iPaper$(rnd 10)@"

# ---------- banner ----------
cat <<EOF

${C}╔══════════════════════════════════════════════╗
║   iPaper — Deploy khách hàng mới             ║
╚══════════════════════════════════════════════╝${N}

  Domain:          $DOMAIN
  Mã tổ chức:      $TENANT_SLUG
  Tên tổ chức:     $TENANT_NAME
  Admin:           $ADMIN_USER / $ADMIN_EMAIL
  Màu brand:       $BRAND_COLOR
  Thư mục code:    $PROJECT_DIR

EOF
ask "Tiếp tục? (y/N)"
read -r confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { err "Đã hủy."; exit 0; }

# ---------- 1. Kiểm tra môi trường ----------
info "Kiểm tra Docker..."
command -v docker >/dev/null || { err "Chưa cài Docker. Chạy: curl -fsSL https://get.docker.com | sh"; exit 1; }
docker info >/dev/null 2>&1 || { err "Docker daemon chưa chạy"; exit 1; }
ok "Docker OK"

# Kiểm tra cổng 80/443 chưa bị chiếm
if ss -tln 2>/dev/null | grep -qE ':(80|443) '; then
  err "Cổng 80/443 đang bị chiếm. Dừng service đang dùng rồi chạy lại."
  ss -tlnp 2>/dev/null | grep -E ':(80|443) '
  exit 1
fi
ok "Cổng 80/443 trống"

# ---------- 2. Clone / cập nhật code ----------
if [ -d "$PROJECT_DIR/.git" ]; then
  info "Project đã có, force cập nhật code mới nhất (local changes sẽ bị overwrite)..."
  (cd "$PROJECT_DIR" && git fetch origin && git reset --hard origin/master && git clean -fd)
else
  info "Clone code iPaper về $PROJECT_DIR..."
  read -p "GitHub token (quyền read repo): " -s GH_TOKEN
  echo
  git clone "https://$GH_TOKEN@github.com/khanhbinhsua/ipaper.git" "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"
ok "Code sẵn sàng"

# ---------- 3. Thay màu brand (nếu khác mặc định) ----------
if [ "$BRAND_COLOR" != "#E4002B" ]; then
  info "Thay màu brand #E4002B → $BRAND_COLOR trong frontend..."
  find frontend/src frontend/public -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
    -exec sed -i "s/#E4002B/$BRAND_COLOR/gi" {} +
  # Favicon PWA cần regenerate — để đó, nhân viên vẫn hoạt động, chỉ icon vẫn đỏ
  ok "Đã thay $(grep -rl "$BRAND_COLOR" frontend/src | wc -l) file"
fi

# ---------- 4. Sinh .env.prod ----------
info "Sinh file .env.prod..."
cat > .env.prod <<EOF
# === Tự sinh bởi new-customer.sh — $(date +%F' '%T) ===
APP_DOMAIN=$DOMAIN
NODE_ENV=production
PORT=3000
TZ=UTC
# Lần đầu bật DB_SYNC để tạo bảng; sau khi OK sẽ tự tắt ở cuối script
DB_SYNC=true
FRONTEND_URL=$([ "$IS_IP_ONLY" = "1" ] && echo "http://$DOMAIN" || echo "https://$DOMAIN")

# PostgreSQL
DB_HOST=ipaper_postgres
DB_PORT=5432
DB_NAME=ipaper
DB_USER=ipaper
DB_PASS=$DB_PASS

# Redis
REDIS_HOST=ipaper_redis
REDIS_PORT=6379

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h

# S3 storage (SeaweedFS - API tương thích với MinIO/AWS S3)
MINIO_ENDPOINT=ipaper-minio
MINIO_PORT=8333
MINIO_USE_SSL=false
MINIO_USER=minioadmin
MINIO_PASS=$MINIO_PASS
MINIO_BUCKET=ipaper-files
MINIO_PUBLIC_ENDPOINT=$DOMAIN
MINIO_PUBLIC_PORT=$([ "$IS_IP_ONLY" = "1" ] && echo "80" || echo "443")
MINIO_PUBLIC_USE_SSL=$([ "$IS_IP_ONLY" = "1" ] && echo "false" || echo "true")
EOF
chmod 600 .env.prod
ok ".env.prod đã tạo (mật khẩu random mạnh)"

# Sinh file config SeaweedFS S3 với credentials khớp
sed -e "s|__MINIO_USER__|minioadmin|g" -e "s|__MINIO_PASS__|$MINIO_PASS|g" \
  deploy/seaweedfs-s3.json.template > deploy/seaweedfs-s3.json
chmod 644 deploy/seaweedfs-s3.json
ok "seaweedfs-s3.json đã tạo"

# ---------- 4b. Generate Caddyfile phù hợp (IP → HTTP, domain → HTTPS) ----------
if [ "$IS_IP_ONLY" = "1" ]; then
  info "Chế độ IP-only — Caddy sẽ bind HTTP cổng 80 (không HTTPS)"
  cat > deploy/Caddyfile <<'CADDY'
# IP-only mode: HTTP thuần, không có SSL
:80 {
    encode gzip
    handle /api/*          { reverse_proxy ipaper_backend:3000 }
    handle /socket.io/*    { reverse_proxy ipaper_backend:3000 }
    handle /ipaper-files/* { reverse_proxy ipaper-minio:8333 }
    @pwa path /sw.js /workbox-*.js /manifest.webmanifest /firebase-messaging-sw.js
    header @pwa Cache-Control "no-cache, no-store, must-revalidate"
    handle                 { reverse_proxy ipaper_frontend:80 }
}
CADDY
else
  info "Caddy sẽ tự xin HTTPS Let's Encrypt — KIỂM TRA DNS $DOMAIN đã trỏ về IP VPS!"
  # File deploy/Caddyfile template sẵn trong repo đã đúng (dùng {$APP_DOMAIN})
fi

# ---------- 5. Build & chạy stack ----------
info "Build + chạy stack (Postgres, Redis, MinIO, Backend, Frontend, Caddy)..."
docker compose -f docker-compose.standalone.yml --env-file .env.prod up -d --build

info "Đợi backend khởi động + tạo schema DB (60s)..."
for i in {1..30}; do
  if docker compose -f docker-compose.standalone.yml --env-file .env.prod logs backend 2>/dev/null | grep -q 'backend running'; then
    ok "Backend ready"; break
  fi
  sleep 2
done

# ---------- 6. Tạo admin + tổ chức ----------
info "Tạo tổ chức '$TENANT_SLUG' + admin '$ADMIN_USER'..."
docker compose -f docker-compose.standalone.yml --env-file .env.prod exec -T \
  -e INIT_TENANT_SLUG="$TENANT_SLUG" \
  -e INIT_TENANT_NAME="$TENANT_NAME" \
  -e INIT_ADMIN_USER="$ADMIN_USER" \
  -e INIT_ADMIN_PASS="$ADMIN_PASS" \
  -e INIT_ADMIN_EMAIL="$ADMIN_EMAIL" \
  backend node dist/init.js || { err "Tạo admin thất bại"; exit 1; }

# ---------- 7. Tắt DB_SYNC cho an toàn + setup cron SSL renew ----------
info "Tắt DB_SYNC (an toàn schema)..."
sed -i 's/^DB_SYNC=.*/DB_SYNC=false/' .env.prod
docker compose -f docker-compose.standalone.yml --env-file .env.prod up -d backend

# ---------- 8. Xuất credentials ra file ----------
CRED_FILE="$HOME/ipaper-credentials-$TENANT_SLUG.txt"
cat > "$CRED_FILE" <<EOF
╔══════════════════════════════════════════════╗
║  iPaper — Thông tin triển khai $TENANT_SLUG
║  Tạo lúc: $(date +%F' '%T)
╚══════════════════════════════════════════════╝

TRUY CẬP WEB
  URL:           $([ "$IS_IP_ONLY" = "1" ] && echo "http" || echo "https")://$DOMAIN
  Mã tổ chức:    $TENANT_SLUG
$([ "$IS_IP_ONLY" = "1" ] && cat <<'NOTE'
  ⚠ Đang chạy HTTP (vì dùng IP) — PWA + Push notification KHÔNG hoạt động.
    Khi có domain thật:
      1. Sửa APP_DOMAIN trong .env.prod thành domain mới
      2. Sửa MINIO_PUBLIC_USE_SSL=true, MINIO_PUBLIC_PORT=443 trong .env.prod
      3. Khôi phục deploy/Caddyfile từ repo: git checkout deploy/Caddyfile
      4. docker compose -f docker-compose.standalone.yml --env-file .env.prod up -d
NOTE
)

TÀI KHOẢN ADMIN (đổi mật khẩu NGAY sau lần đăng nhập đầu)
  Username:      $ADMIN_USER
  Password:      $ADMIN_PASS
  Email:         $ADMIN_EMAIL

HẠ TẦNG (lưu kín)
  DB password:   $DB_PASS
  MinIO pass:    $MINIO_PASS
  JWT secret:    $JWT_SECRET

VẬN HÀNH THƯỜNG NGÀY
  cd $PROJECT_DIR

  # Log backend
  docker compose -f docker-compose.standalone.yml --env-file .env.prod logs backend -f

  # Cập nhật code mới
  git pull && docker compose -f docker-compose.standalone.yml --env-file .env.prod up -d --build

  # Backup DB (nên chạy định kỳ)
  docker exec ipaper_postgres pg_dump -U ipaper ipaper | gzip > ~/backup_\$(date +%F).sql.gz

PUSH NOTIFICATION (chưa setup — tùy chọn)
  Để nhận thông báo khi khóa màn hình:
  1. Tạo Firebase project (console.firebase.google.com)
  2. Lấy firebaseConfig + VAPID key → sửa frontend/src/lib/firebase.ts
  3. Tải firebase-admin.json → copy vào $PROJECT_DIR/backend/
  4. docker compose ... up -d --build
EOF
chmod 600 "$CRED_FILE"

# ---------- 9. In kết quả ----------
echo
ok "DEPLOY THÀNH CÔNG!"
echo
PROTO=$([ "$IS_IP_ONLY" = "1" ] && echo "http" || echo "https")
echo "  ${C}Web:${N}        $PROTO://$DOMAIN"
echo "  ${C}Tổ chức:${N}    $TENANT_SLUG"
echo "  ${C}Admin:${N}      $ADMIN_USER / $ADMIN_PASS"
echo
echo "  ${Y}Credentials đã lưu tại:${N} $CRED_FILE"
echo
echo "  ${Y}Lưu ý:${N}"
echo "  • Caddy đang xin HTTPS Let's Encrypt — đợi 30-60s cho cert cấp xong"
echo "  • Nếu web chưa vào được: kiểm tra DNS $DOMAIN đã trỏ về IP VPS chưa"
echo "  • Push notification chưa setup — xem $CRED_FILE để làm sau (tùy chọn)"
echo
