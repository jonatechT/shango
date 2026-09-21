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
        Schema::table('equipements', function (Blueprint $table) {
            $table->string('nom')->nullable()->after('reference');
            $table->text('description')->nullable()->after('nom');
            $table->string('client_nom')->nullable()->after('description');
            $table->string('client_numero')->nullable()->after('client_nom');
            $table->string('marque_modele')->nullable()->after('client_numero');
            $table->string('site')->nullable()->after('marque_modele');
            $table->string('photo')->nullable()->after('site');
            $table->decimal('perimetre_metres', 10, 2)->nullable()->after('photo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('equipements', function (Blueprint $table) {
            $table->dropColumn([
                'nom',
                'description',
                'client_nom',
                'client_numero',
                'marque_modele',
                'site',
                'photo',
                'perimetre_metres',
            ]);
        });
    }
};