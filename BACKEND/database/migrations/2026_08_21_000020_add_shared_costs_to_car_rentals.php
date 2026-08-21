<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rental_shared_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_comparison_id')
                ->constrained('car_rental_comparisons')
                ->cascadeOnDelete();
            $table->string('name'); // Gửi xe, Trạm thu phí, ...
            $table->unsignedBigInteger('amount')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            // Tổng chi phí chung cả chuyến, áp cho mọi phương án như nhau.
            $table->unsignedBigInteger('total_shared_cost')->default(0)->after('saving_amount');
        });

        Schema::table('car_rental_options', function (Blueprint $table) {
            // total_cost + total_shared_cost. Tách riêng để total_cost giữ nguyên
            // nghĩa "chi phí của riêng chiếc xe" cho phần so sánh.
            $table->unsignedBigInteger('trip_total_cost')->default(0)->after('total_cost');
        });
    }

    public function down(): void
    {
        Schema::table('car_rental_options', function (Blueprint $table) {
            $table->dropColumn('trip_total_cost');
        });

        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            $table->dropColumn('total_shared_cost');
        });

        Schema::dropIfExists('car_rental_shared_costs');
    }
};
