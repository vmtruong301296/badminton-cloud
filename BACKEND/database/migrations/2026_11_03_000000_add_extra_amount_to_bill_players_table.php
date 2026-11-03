<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tiền cộng thêm kèm nội dung cho từng người chơi (vd "Tiền cộng thêm 10k ở
 * trận trước"). Khoản này nằm trong chi phí thêm cùng menu nước nên vẫn được
 * cộng vào menu_extra_total.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bill_players', function (Blueprint $table) {
            $table->integer('extra_amount')->default(0)->after('menu_extra_total');
            $table->string('extra_note')->nullable()->after('extra_amount');
        });
    }

    public function down(): void
    {
        Schema::table('bill_players', function (Blueprint $table) {
            $table->dropColumn(['extra_amount', 'extra_note']);
        });
    }
};
