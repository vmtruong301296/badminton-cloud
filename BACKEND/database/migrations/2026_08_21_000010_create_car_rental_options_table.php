<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rental_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_comparison_id')
                ->constrained('car_rental_comparisons')
                ->cascadeOnDelete();

            // Đầu vào
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('rental_per_day')->default(0);
            $table->string('fuel_type', 20)->default('none'); // petrol | electric | none
            $table->decimal('consumption_per_100', 8, 2)->default(0); // L/100km hoặc kWh/100km
            $table->unsignedInteger('fuel_unit_price')->default(0); // đ/L hoặc đ/kWh, 0 = miễn phí
            $table->unsignedBigInteger('extra_fixed_cost')->default(0);
            $table->unsignedInteger('km_limit_per_day')->nullable(); // null = không giới hạn
            $table->unsignedInteger('over_km_fee')->default(0);

            // Kết quả backend tính, lưu snapshot
            $table->unsignedBigInteger('rental_cost')->default(0);
            $table->unsignedBigInteger('fuel_cost')->default(0);
            $table->unsignedBigInteger('over_km_cost')->default(0);
            $table->unsignedBigInteger('total_cost')->default(0);
            $table->unsignedInteger('cost_per_km')->default(0);
            $table->unsignedInteger('per_person_cost')->default(0);
            $table->boolean('is_cheapest')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_options');
    }
};
