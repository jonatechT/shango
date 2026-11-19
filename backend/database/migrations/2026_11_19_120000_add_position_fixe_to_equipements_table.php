<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Position fixe mémorisée d'un équipement : affichée tant que le GPS du
 * boîtier n'a pas de signal (aucune latitude/longitude dans la télémétrie).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipements', function (Blueprint $table) {
            $table->decimal('latitude_fixe', 10, 7)->nullable();
            $table->decimal('longitude_fixe', 10, 7)->nullable();
            $table->timestamp('position_fixe_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('equipements', function (Blueprint $table) {
            $table->dropColumn(['latitude_fixe', 'longitude_fixe', 'position_fixe_le']);
        });
    }
};
