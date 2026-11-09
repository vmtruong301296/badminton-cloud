<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cách chia tiền của bill: "ratio" (tổng tiền chia theo mức tính, như trước
 * giờ) hoặc "match" (bill con chia theo từng trận, xem bảng bill_matches).
 * Bill cũ giữ "ratio".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->string('split_mode', 10)->default('ratio')->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->dropColumn('split_mode');
        });
    }
};
