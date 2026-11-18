<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tài khoản nhận tiền chọn sẵn khi người dùng này mở hộp "Gửi ảnh bill".
 * Null (hoặc tài khoản bị xoá / tắt) thì frontend chọn như cũ: VPBank, không thì tài khoản đầu tiên.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('default_payment_account_id')
                ->nullable()
                ->after('phone')
                ->constrained('payment_accounts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_payment_account_id');
        });
    }
};
