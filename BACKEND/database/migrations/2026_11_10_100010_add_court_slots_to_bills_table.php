<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Khung giờ sân của bill con (bảng "Tính theo giờ"): [{"start":"21:00","end":"21:10"}, ...]
 * theo thứ tự Sân 1, Sân 2... Chỉ để mở lại sửa vẫn thấy các sân đã chọn; tiền sân vẫn là
 * court_total. Bill cũ và bill chính để null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->json('court_slots')->nullable()->after('court_total');
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->dropColumn('court_slots');
        });
    }
};
