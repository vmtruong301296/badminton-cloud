<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Giá sân (Master → Giá sân): đơn giá một sân cho 2 giờ, lên giá theo ngày áp dụng như loại cầu
 * (shuttle_type_prices). Bill con tính tiền sân theo giờ bằng mốc mới nhất không sau ngày bill.
 * Mốc đầu 140.000đ áp dụng cho mọi ngày từ trước tới nay.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('court_prices', function (Blueprint $table) {
            $table->id();
            $table->date('effective_from')->unique();
            $table->unsignedInteger('price'); // đ / sân / 2 giờ
            $table->timestamps();
        });

        $now = now();
        DB::table('court_prices')->insert([
            'effective_from' => '1970-01-01',
            'price' => 140000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('court_prices');
    }
};
