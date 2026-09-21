<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telemetries', function (Blueprint $table) {

            $table->id();

            // Équipement SHANGO concerné
            $table->foreignId('equipement_id')
                  ->constrained('equipements')
                  ->cascadeOnDelete();

            // Identifiant envoyé par le boîtier IoT
            $table->string('device_id');

            // Date/heure envoyée par le boîtier
            $table->timestamp('horodatage');

            // Position GPS
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            // Données électriques
            $table->decimal('tension', 8, 2)->nullable();
            $table->decimal('courant', 8, 2)->nullable();

            // Température du boîtier
            $table->decimal('temperature', 8, 2)->nullable();

            // État du kit : MARCHE / BLOQUE
            $table->string('etat_kit')->nullable();

            // Statut du paiement
            $table->string('statut_paiement')->nullable();

            // Signal GSM
            $table->integer('signal_gsm')->nullable();

            $table->timestamps();

            // Index utiles pour les recherches
            $table->index('device_id');
            $table->index('horodatage');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telemetries');
    }
};