<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interventions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('maintenance_id')
                  ->nullable()
                  ->constrained('maintenances')
                  ->nullOnDelete();

            $table->foreignId('equipement_id')
                  ->constrained('equipements')
                  ->cascadeOnDelete();

            $table->foreignId('technicien_id')
                  ->constrained('users')
                  ->cascadeOnDelete();

            $table->dateTime('date_intervention');
            $table->text('diagnostic')->nullable();
            $table->text('actions_realisees')->nullable();
            $table->json('pieces_utilisees')->nullable();
            $table->string('etat_equipement_apres')->nullable();
            $table->text('commentaire')->nullable();
            $table->enum('status', ['en_attente', 'en_cours', 'resolu', 'a_suivre'])
                  ->default('en_attente');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interventions');
    }
};