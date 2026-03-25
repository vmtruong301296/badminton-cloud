<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shuttle_stock_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shuttle_type_id')->constrained('shuttle_types')->cascadeOnDelete();
            $table->unsignedInteger('tubes')->default(0)->comment('Số ống (1 ống = 12 quả)');
            $table->unsignedInteger('balls')->default(0)->comment('Số quả lẻ');
            $table->unsignedInteger('total_balls')->comment('tubes*12 + balls');
            $table->date('entered_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shuttle_stock_entries');
    }
};
