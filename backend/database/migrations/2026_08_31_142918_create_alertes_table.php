<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Créer la table alertes
     */
    public function up(): void
    {
        Schema::create('alertes', function (Blueprint $table) {

            $table->id();

            // Équipement SHANGO concerné
            $table->foreignId('equipement_id')
                ->constrained('equipements')
                ->cascadeOnDelete();

            // Identifiant envoyé par le boîtier IoT
            $table->string('device_id');

            // Type de l'alerte
            // Exemple : CHOC
            $table->string('type_alerte');

            // Gravité de l'alerte
            // Exemple : ELEVEE
            $table->string('gravite');

            // Valeur associée à l'alerte
            // Exemple : 8.2
            $table->decimal('valeur', 10, 2)->nullable();

            // Timestamp Unix converti en date/heure Laravel
            $table->timestamp('horodatage');

            $table->timestamps();

            // Index utiles
            $table->index('device_id');
            $table->index('type_alerte');
            $table->index('gravite');
            $table->index('horodatage');
        });
    }

    /**
     * Supprimer la table alertes
     */
    public function down(): void
    {
        Schema::dropIfExists('alertes');
    }
};