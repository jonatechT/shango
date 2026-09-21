<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->foreignId('equipement_id')
                ->constrained('equipements')
                ->cascadeOnDelete();

            $table->foreignId('reported_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('type');

            $table->text('description');

            $table->enum('priority', [
                'basse',
                'moyenne',
                'haute'
            ])->default('moyenne');

            $table->enum('status', [
                'en_attente',
                'en_cours',
                'resolu',
                'a_suivre'
            ])->default('en_attente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropForeign(['equipement_id']);
            $table->dropForeign(['reported_by']);

            $table->dropColumn([
                'equipement_id',
                'reported_by',
                'type',
                'description',
                'priority',
                'status',
            ]);
        });
    }
};