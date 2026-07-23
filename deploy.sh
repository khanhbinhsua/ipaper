#!/bin/bash
# ============================================================
# PAPERLESS OFFICE - VPS DEPLOYMENT SCRIPT
# ============================================================
# Sử dụng: ssh user@vps-ip 'bash -s' < deploy.sh
# Hoặc copy lên VPS rồi chạy: chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

# ===================== CẤU HÌNH =====================
# Thay đổi các biến sau cho phù hợp VPS của bạn
REPO_URL="https://github.com/khanhbinhsua/ipaper.git"
BRANCH="master"
APP_DIR="/opt/paperless"                    # Thư mục gốc trên VPS
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
FRONTEND_SERVE_DIR="/var/www/paperless"     # Thư mục serve frontend (Nginx)
NODE_VERSION="20"                           # Node.js version
PM2_APP_NAME="paperless-backend"            # Tên process PM2

# ===================== MÀU SẮC LOG =====================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===================== KIỂM TRA PREREQUISITES =====================
log_info "=========================================="
log_info "  PAPERLESS OFFICE - DEPLOYMENT"
log_info "=========================================="
log_info "Thời gian: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js chưa được cài đặt!"
    log_info "Cài đặt: curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
log_info "Node.js version: $(node -v)"

# Kiểm tra npm
if ! command -v npm &> /dev/null; then
    log_error "npm chưa được cài đặt!"
    exit 1
fi
log_info "npm version: $(npm -v)"

# Kiểm tra PM2
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 chưa được cài đặt, đang cài..."
    npm install -g pm2
fi
log_info "PM2 version: $(pm2 -v)"

# Kiểm tra Git
if ! command -v git &> /dev/null; then
    log_error "Git chưa được cài đặt!"
    exit 1
fi

echo ""

# ===================== STEP 1: CLONE HOẶC PULL CODE =====================
log_info "STEP 1: Cập nhật source code..."

if [ -d "$APP_DIR/.git" ]; then
    log_info "Repository đã tồn tại, đang pull code mới..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    git clean -fd
else
    log_info "Clone repository mới..."
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $(whoami):$(whoami) "$APP_DIR"
    git clone -b $BRANCH "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

log_info "✅ Source code đã cập nhật (commit: $(git rev-parse --short HEAD))"
echo ""

# ===================== STEP 2: BACKEND =====================
log_info "STEP 2: Build Backend..."

cd "$BACKEND_DIR"

# Cài đặt dependencies
log_info "Cài đặt backend dependencies..."
npm ci --production=false 2>&1 | tail -1

# Build TypeScript
log_info "Biên dịch TypeScript..."
npm run build 2>&1 | tail -3

# Tạo file .env nếu chưa có
if [ ! -f "$BACKEND_DIR/.env" ]; then
    log_warn "File .env chưa tồn tại! Tạo file mẫu..."
    cat > "$BACKEND_DIR/.env" << 'ENVEOF'
# DATABASE
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=paperless
DB_PASSWORD=your_password_here
DB_DATABASE=paperless

# JWT
JWT_SECRET=your_jwt_secret_here

# SERVER
PORT=3000
NODE_ENV=production

# FILE UPLOAD
UPLOAD_DIR=./uploads
ENVEOF
    log_warn "⚠️  Vui lòng cập nhật file $BACKEND_DIR/.env với thông tin thực tế!"
fi

# Khởi động lại backend với PM2
log_info "Khởi động lại backend với PM2..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
    log_info "✅ Backend đã restart"
else
    pm2 start dist/main.js --name "$PM2_APP_NAME" --env production
    pm2 save
    log_info "✅ Backend đã khởi động lần đầu"
fi

echo ""

# ===================== STEP 3: FRONTEND =====================
log_info "STEP 3: Build Frontend..."

cd "$FRONTEND_DIR"

# Cài đặt dependencies
log_info "Cài đặt frontend dependencies..."
npm ci 2>&1 | tail -1

# Build production
log_info "Build production bundle..."
npm run build 2>&1 | tail -3

# Copy build sang thư mục serve
log_info "Deploy frontend files..."
sudo mkdir -p "$FRONTEND_SERVE_DIR"
sudo rm -rf "$FRONTEND_SERVE_DIR"/*
sudo cp -r dist/* "$FRONTEND_SERVE_DIR/"
sudo chown -R www-data:www-data "$FRONTEND_SERVE_DIR"

log_info "✅ Frontend đã deploy tại $FRONTEND_SERVE_DIR"
echo ""

# ===================== STEP 4: NGINX CONFIG (nếu chưa có) =====================
NGINX_CONF="/etc/nginx/sites-available/paperless"
if [ ! -f "$NGINX_CONF" ]; then
    log_warn "Chưa có Nginx config cho Paperless. Tạo config mẫu..."
    sudo tee "$NGINX_CONF" > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;  # Thay bằng domain thực tế

    # Frontend (React SPA)
    root /var/www/paperless;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # File uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
    }
}
NGINXEOF

    # Enable site
    sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/paperless
    sudo nginx -t && sudo systemctl reload nginx
    log_info "✅ Nginx config đã tạo và reload"
else
    log_info "Nginx config đã tồn tại, reload..."
    sudo nginx -t && sudo systemctl reload nginx
fi

echo ""

# ===================== STEP 5: KIỂM TRA =====================
log_info "STEP 5: Kiểm tra hệ thống..."

# Kiểm tra backend đang chạy
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
    log_info "✅ Backend ($PM2_APP_NAME) đang chạy"
    pm2 show "$PM2_APP_NAME" | grep -E "status|memory|uptime"
else
    log_error "❌ Backend không chạy!"
fi

# Kiểm tra Nginx
if systemctl is-active --quiet nginx; then
    log_info "✅ Nginx đang chạy"
else
    log_error "❌ Nginx không chạy!"
fi

echo ""
log_info "=========================================="
log_info "  🎉 DEPLOYMENT HOÀN TẤT!"
log_info "=========================================="
log_info "Backend:  PM2 process '$PM2_APP_NAME' (port 3000)"
log_info "Frontend: $FRONTEND_SERVE_DIR"
log_info "Commit:   $(cd $APP_DIR && git rev-parse --short HEAD)"
log_info ""
log_info "Lệnh hữu ích:"
log_info "  pm2 logs $PM2_APP_NAME    - Xem logs backend"
log_info "  pm2 monit                  - Monitor tất cả processes"
log_info "  pm2 restart $PM2_APP_NAME - Restart backend"
log_info "=========================================="
