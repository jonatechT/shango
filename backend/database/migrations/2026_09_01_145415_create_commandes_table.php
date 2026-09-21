<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Créer la table commandes
     */
    public function up(): void
    {
        Schema::create('commandes', function (Blueprint $table) {

            $table->id();

            // Équipement concerné
            $table->foreignId('equipement_id')
                ->constrained('equipements')
                ->cascadeOnDelete();

            // Identifiant du boîtier IoT
            $table->string('device_id');

            // Commande envoyée
            // Exemple : BLOQUER / DEBLOQUER
            $table->string('commande');

            // Origine de la commande
            // Exemple : systeme_payg / utilisateur
            $table->string('emis_par');

            // Raison de la commande
            // Exemple : impaye / paiement_regle
            $table->string('raison')->nullable();

            // Statut de transmission
            // Exemple : transmise / echouee
            $table->string('statut')->default('en_attente');

            // Réponse reçue du Bridge
            $table->text('reponse_bridge')->nullable();

            $table->timestamps();

            // Index utiles
            $table->index('device_id');
            $table->index('commande');
            $table->index('statut');
            $table->index('created_at');
        });
    }

    /**
     * Supprimer la table commandes
     */
    public function down(): void
    {
        Schema::dropIfExists('commandes');
    }
};