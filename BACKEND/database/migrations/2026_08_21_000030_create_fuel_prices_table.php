<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_prices', function (Blueprint $table) {
            $table->id();
            $table->string('fuel_key', 50)->unique(); // e10_ron95_iii
            $table->unsignedInteger('price')->default(0); // đ/lít
            $table->json('sources')->nullable(); // {"baohatinh.vn":22660,...}
            $table->date('source_date')->nullable(); // ngày nguồn công bố, nếu có
            $table->timestamp('fetched_at')->nullable(); // lần cào THÀNH CÔNG gần nhất
            $table->timestamp('last_checked_at')->nullable(); // lần THỬ gần nhất
            $table->string('last_error', 255)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_prices');
    }
};
