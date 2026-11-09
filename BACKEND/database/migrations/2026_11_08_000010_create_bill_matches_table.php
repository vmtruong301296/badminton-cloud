<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Các trận của bill chia theo trận: mỗi trận một loại cầu + số quả (giá theo
 * ngày bill), người đánh nằm ở bill_match_players.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('bills')->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->foreignId('shuttle_type_id')->constrained('shuttle_types');
            $table->integer('quantity');
            $table->integer('price_each');
            $table->integer('subtotal');
            $table->timestamps();
        });

        Schema::create('bill_match_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_match_id')->constrained('bill_matches')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->unique(['bill_match_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_match_players');
        Schema::dropIfExists('bill_matches');
    }
};
