<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Cho phép thành tiền âm khi người tham gia đã chi nhiều hơn phần chia (share + food - paid).
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE party_bill_participants MODIFY total_amount INT NOT NULL DEFAULT 0');
        } elseif ($driver === 'sqlite') {
            // SQLite không phân biệt signed/unsigned cho INTEGER; bỏ qua nếu đã là số nguyên
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            // Chỉ revert khi không còn giá trị âm
            DB::statement('ALTER TABLE party_bill_participants MODIFY total_amount INT UNSIGNED NOT NULL DEFAULT 0');
        }
    }
};
