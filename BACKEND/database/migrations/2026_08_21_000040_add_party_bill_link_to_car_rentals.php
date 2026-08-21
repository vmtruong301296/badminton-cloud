<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            // Xóa bill tiệc thì lần thuê xe chỉ mất liên kết, không bị xóa theo.
            $table->foreignId('party_bill_id')
                ->nullable()
                ->after('created_by')
                ->constrained('party_bills')
                ->nullOnDelete();

            // Phương án thực tế thuê, trỏ vào car_rental_options.sort_order.
            // null = dùng phương án rẻ nhất.
            $table->unsignedInteger('selected_sort_order')->nullable()->after('party_bill_id');
        });

        Schema::table('party_bill_extras', function (Blueprint $table) {
            // Khác null = dòng do thuê xe sở hữu, màn bill tiệc không được sửa.
            $table->foreignId('car_rental_comparison_id')
                ->nullable()
                ->after('party_bill_id')
                ->constrained('car_rental_comparisons')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('party_bill_extras', function (Blueprint $table) {
            $table->dropForeign(['car_rental_comparison_id']);
            $table->dropColumn('car_rental_comparison_id');
        });

        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            $table->dropForeign(['party_bill_id']);
            $table->dropColumn(['party_bill_id', 'selected_sort_order']);
        });
    }
};
