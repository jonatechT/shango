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
        Schema::table('predictions_batteries', function (Blueprint $table) {

            // Classe SOH retournée par le modèle IA
            $table->string('soh_class')->nullable()->after('soh_pourcent');

            // Identifiant numérique de la classe SOH
            $table->unsignedTinyInteger('soh_class_id')
                ->nullable()
                ->after('soh_class');

            // Probabilités des différentes classes SOH
            $table->json('soh_probabilities')
                ->nullable()
                ->after('soh_class_id');

            // Niveau de confiance de la prédiction
            $table->decimal('confidence', 8, 6)
                ->nullable()
                ->after('soh_probabilities');

            // RUL retourné par le modèle, en cycles
            $table->unsignedInteger('rul_cycles')
                ->nullable()
                ->after('confidence');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('predictions_batteries', function (Blueprint $table) {

            $table->dropColumn([
                'soh_class',
                'soh_class_id',
                'soh_probabilities',
                'confidence',
                'rul_cycles',
            ]);
        });
    }
};
