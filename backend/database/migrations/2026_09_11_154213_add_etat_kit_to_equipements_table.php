<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajouter l'état opérationnel du kit.
     */
    public function up(): void
    {
        Schema::table('equipements', function (Blueprint $table) {
            $table->enum('etat_kit', ['MARCHE', 'BLOQUE'])
                  ->nullable()
                  ->after('status');
        });
    }

    /**
     * Supprimer l'état opérationnel du kit.
     */
    public function down(): void
    {
        Schema::table('equipements', function (Blueprint $table) {
            $table->dropColumn('etat_kit');
        });
    }
};