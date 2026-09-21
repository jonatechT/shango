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
        Schema::create('predictions_batteries', function (Blueprint $table) {
            $table->id();

            $table->string('device_id');

            $table->dateTime('date_heure');

            // Données reçues du boîtier
            $table->decimal('voltage_v', 8, 3);
            $table->decimal('current_a', 8, 3);
            $table->decimal('temperature_c', 8, 3);
            $table->decimal('dod_percent', 5, 2);

            // Résultats et informations calculées par l'IA
            $table->decimal('soh_pourcent', 5, 2)->nullable();
            $table->decimal('capacite_ah', 8, 3)->nullable();
            $table->decimal('rul_jours', 8, 2)->nullable();

            // État de la batterie
            $table->string('etat')->nullable();

            $table->timestamps();

            $table->index('device_id');
            $table->index('date_heure');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('predictions_batteries');
    }
};