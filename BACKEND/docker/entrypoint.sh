#!/bin/sh
set -e

if [ -z "${APP_KEY:-}" ]; then
    echo "ERROR: APP_KEY is not set. Generate one with: php artisan key:generate --show" >&2
    exit 1
fi

export PORT="${PORT:-8080}"
envsubst '${PORT}' < /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf

php artisan storage:link --force || true

php artisan migrate --force || echo "Migrate failed or already up to date"

php artisan db:seed --class=RolePermissionSeeder --force || echo "RolePermissionSeeder failed"

php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache

exec "$@"
