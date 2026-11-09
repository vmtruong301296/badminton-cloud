<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Người đánh của trận thuộc bên nào: 1 = Cặp A, 2 = Cặp B (đánh đơn: mỗi bên một người).
 * Trận đã có: nửa đầu người chơi theo thứ tự đã chọn là Cặp A, nửa sau là Cặp B.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bill_match_players', function (Blueprint $table) {
            $table->unsignedTinyInteger('side')->default(1)->after('user_id');
        });

        DB::table('bill_match_players')
            ->orderBy('id')
            ->get(['id', 'bill_match_id'])
            ->groupBy('bill_match_id')
            ->each(function ($rows) {
                $secondHalf = $rows->slice(intdiv($rows->count(), 2))->pluck('id');
                DB::table('bill_match_players')->whereIn('id', $secondHalf)->update(['side' => 2]);
            });
    }

    public function down(): void
    {
        Schema::table('bill_match_players', function (Blueprint $table) {
            $table->dropColumn('side');
        });
    }
};
