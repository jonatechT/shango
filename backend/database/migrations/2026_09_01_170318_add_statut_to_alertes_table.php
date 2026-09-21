<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajouter le statut aux alertes.
     */
    public function up(): void
    {
        Schema::table('alertes', function (Blueprint $table) {
            $table->string('statut')
                ->default('nouvelle')
                ->after('gravite');
        });
    }

    /**
     * Annuler la modification.
     */
    public function down(): void
    {
        Schema::table('alertes', function (Blueprint $table) {
            $table->dropColumn('statut');
        });
    }
};