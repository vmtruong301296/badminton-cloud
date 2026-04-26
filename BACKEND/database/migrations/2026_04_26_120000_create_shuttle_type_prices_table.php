<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shuttle_type_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shuttle_type_id')->constrained('shuttle_types')->cascadeOnDelete();
            $table->date('effective_from');
            $table->integer('price');
            $table->timestamps();

            $table->unique(['shuttle_type_id', 'effective_from']);
        });

        $now = now();
        foreach (DB::table('shuttle_types')->get() as $row) {
            DB::table('shuttle_type_prices')->insert([
                'shuttle_type_id' => $row->id,
                'effective_from' => '1970-01-01',
                'price' => (int) $row->price,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shuttle_type_prices');
    }
};
