<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rental_comparisons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->date('date')->nullable();
            $table->unsignedInteger('days')->default(1); // Số ngày thuê
            $table->unsignedInteger('distance_km')->default(0); // Tổng km cả đi lẫn về
            $table->unsignedInteger('people_count')->default(0); // 0 = không chia đầu người
            $table->text('note')->nullable();
            $table->unsignedInteger('break_even_km')->nullable(); // null khi không có nghiệm
            $table->unsignedBigInteger('saving_amount')->default(0); // rẻ nhì - rẻ nhất
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_comparisons');
    }
};
