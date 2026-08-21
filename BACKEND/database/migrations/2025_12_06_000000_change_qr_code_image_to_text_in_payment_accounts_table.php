<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // SQLite không có cú pháp ALTER COLUMN, và cũng không cần: kiểu dữ liệu
        // là động nên cột VARCHAR lưu được text dài tùy ý. Bỏ qua để test chạy
        // được trên sqlite in-memory.
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        // MySQL: dùng raw SQL để khỏi phải cài doctrine/dbal.
        DB::statement('ALTER TABLE payment_accounts MODIFY COLUMN qr_code_image TEXT NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE payment_accounts MODIFY COLUMN qr_code_image VARCHAR(255) NULL');
    }
};
