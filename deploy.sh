#!/bin/bash

# Script tự động deploy BAndF
# Sử dụng: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/BACKEND"
FRONTEND_DIR="$PROJECT_DIR/FRONTEND"

echo "🚀 Bắt đầu deploy BAndF - Environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Không tìm thấy thư mục BACKEND hoặc FRONTEND"
    exit 1
fi

# Step 1: Build Frontend
print_info "Bước 1: Build Frontend..."
cd "$FRONTEND_DIR"

if [ ! -f "package.json" ]; then
    print_error "Không tìm thấy package.json trong FRONTEND"
    exit 1
fi

print_info "Đang cài đặt dependencies..."
npm install

print_info "Đang build production..."
npm run build

if [ ! -d "dist" ]; then
    print_error "Build frontend thất bại - không tìm thấy thư mục dist"
    exit 1
fi

print_success "Build Frontend thành công!"

# Step 2: Deploy Backend
print_info "Bước 2: Chuẩn bị Backend..."
cd "$BACKEND_DIR"

if [ ! -f "composer.json" ]; then
    print_error "Không tìm thấy composer.json trong BACKEND"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_info "Tạo file .env từ .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Vui lòng cấu hình file .env trước khi tiếp tục!"
        exit 1
    else
        print_error "Không tìm thấy .env.example"
        exit 1
    fi
fi

# Install/Update dependencies
print_info "Đang cài đặt Composer dependencies..."
if [ "$ENVIRONMENT" = "production" ]; then
    composer install --optimize-autoloader --no-dev --no-interaction
else
    composer install --optimize-autoloader --no-interaction
fi

# Generate app key if not exists
print_info "Kiểm tra APP_KEY..."
if ! grep -q "APP_KEY=base64:" .env; then
    print_info "Đang generate APP_KEY..."
    php artisan key:generate
fi

# Run migrations
print_info "Đang chạy migrations..."
php artisan migrate --force

# Create storage link
print_info "Đang tạo storage link..."
php artisan storage:link || true

# Optimize Laravel
print_info "Đang tối ưu hóa Laravel..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Reload PHP-FPM để OPcache nạp code mới. Server đặt opcache.validate_timestamps=0
# nên nếu không reload, PHP-FPM vẫn chạy code cũ dù file trên đĩa đã đổi
# (2026-11-03: deploy xong nhưng API vẫn bỏ qua trường mới vì bước này thiếu).
print_info "Đang reload PHP-FPM để nạp code mới..."
if command -v systemctl >/dev/null 2>&1; then
    FPM_UNITS=$(systemctl list-units --type=service --plain --no-legend 'php*-fpm*' 2>/dev/null | awk '{print $1}')
    if [ -z "$FPM_UNITS" ]; then
        print_info "Không tìm thấy service php-fpm, bỏ qua reload"
    fi
    for unit in $FPM_UNITS; do
        if sudo -n systemctl reload "$unit" 2>/dev/null; then
            print_success "Đã reload $unit"
        else
            print_error "Không reload được $unit — hãy chạy tay: sudo systemctl reload $unit"
        fi
    done
else
    print_info "Không có systemctl, bỏ qua reload PHP-FPM"
fi

print_success "Backend đã sẵn sàng!"

# Step 3: Copy Frontend build to Backend public
print_info "Bước 3: Copy Frontend build vào Backend public..."
if [ -d "$BACKEND_DIR/public" ]; then
    # Backup existing files (optional)
    # cp -r "$BACKEND_DIR/public" "$BACKEND_DIR/public.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Copy new build
    cp -r "$FRONTEND_DIR/dist"/* "$BACKEND_DIR/public/"
    print_success "Đã copy Frontend build vào Backend public!"
else
    print_error "Không tìm thấy thư mục public trong BACKEND"
    exit 1
fi

# Step 4: Set permissions
print_info "Bước 4: Thiết lập quyền file..."
if [ "$EUID" -eq 0 ]; then
    chown -R www-data:www-data "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache" || true
fi
chmod -R 775 "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache" || true

print_success "Đã thiết lập quyền file!"

# Summary
echo ""
print_success "✅ Deploy hoàn tất!"
echo ""
print_info "Các bước tiếp theo:"
echo "  1. Kiểm tra cấu hình Nginx/Apache"
echo "  2. Kiểm tra file .env đã đúng chưa"
echo "  3. Test các API endpoints"
echo "  4. Kiểm tra SSL certificate (nếu có)"
echo ""

