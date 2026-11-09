<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Một trận có thể dùng nhiều loại cầu: chuyển loại cầu + số quả của trận sang
 * bill_match_shuttles (mỗi loại một dòng). bill_matches.subtotal giữ tổng tiền
 * cầu của trận.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_match_shuttles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_match_id')->constrained('bill_matches')->cascadeOnDelete();
            $table->foreignId('shuttle_type_id')->constrained('shuttle_types');
            $table->integer('quantity');
            $table->integer('price_each');
            $table->integer('subtotal');
            $table->timestamps();
        });

        DB::statement(
            'INSERT INTO bill_match_shuttles (bill_match_id, shuttle_type_id, quantity, price_each, subtotal, created_at, updated_at)
             SELECT id, shuttle_type_id, quantity, price_each, subtotal, created_at, updated_at FROM bill_matches'
        );

        Schema::table('bill_matches', function (Blueprint $table) {
            $table->dropForeign(['shuttle_type_id']);
        });
        Schema::table('bill_matches', function (Blueprint $table) {
            $table->dropColumn(['shuttle_type_id', 'quantity', 'price_each']);
        });
    }

    /** Trả về một loại cầu mỗi trận: giữ dòng cầu đầu tiên của trận (trận nhiều loại cầu mất các dòng sau). */
    public function down(): void
    {
        Schema::table('bill_matches', function (Blueprint $table) {
            $table->foreignId('shuttle_type_id')->nullable()->after('position')->constrained('shuttle_types');
            $table->integer('quantity')->default(0)->after('shuttle_type_id');
            $table->integer('price_each')->default(0)->after('quantity');
        });

        $first = fn (string $column) => "(SELECT s.{$column} FROM bill_match_shuttles s
            WHERE s.bill_match_id = bill_matches.id ORDER BY s.id LIMIT 1)";
        DB::statement(
            'UPDATE bill_matches SET shuttle_type_id = '.$first('shuttle_type_id')
            .', quantity = COALESCE('.$first('quantity').', 0)'
            .', price_each = COALESCE('.$first('price_each').', 0)'
        );

        Schema::dropIfExists('bill_match_shuttles');
    }
};
