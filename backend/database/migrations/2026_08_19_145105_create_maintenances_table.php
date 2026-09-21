<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenances', function (Blueprint $table) {
            $table->id();

            $table->foreignId('equipement_id')
                  ->constrained('equipements')
                  ->cascadeOnDelete();

            $table->foreignId('incident_id')
                  ->nullable()
                  ->constrained('incidents')
                  ->nullOnDelete();

            $table->enum('type', ['preventive', 'corrective']);

            $table->foreignId('requested_by')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            $table->foreignId('validated_by')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            $table->foreignId('assigned_to')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            $table->enum('status', ['demandee', 'validee', 'planifiee', 'en_cours', 'terminee'])
                  ->default('demandee');

            $table->dateTime('scheduled_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenances');
    }
};