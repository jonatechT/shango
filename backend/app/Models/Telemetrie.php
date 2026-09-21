<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Telemetrie extends Model
{
    /**
     * Table associée au modèle
     */
    protected $table = 'telemetries';

    /**
     * Champs autorisés
     */
    protected $fillable = [
        'equipement_id',
        'device_id',
        'horodatage',
        'latitude',
        'longitude',
        'tension',
        'courant',
        'temperature',
        'humidite',
        'boitier',
        'etat_kit',
        'statut_paiement',
        'signal_gsm',
    ];

    /**
     * Conversion automatique des types
     */
    protected $casts = [
        'horodatage' => 'datetime',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'tension' => 'decimal:2',
        'courant' => 'decimal:2',
        'temperature' => 'decimal:2',
        'humidite' => 'decimal:2',
        'signal_gsm' => 'integer',
    ];

    /**
     * Une télémétrie appartient à un équipement.
     */
    public function equipement(): BelongsTo
    {
        return $this->belongsTo(Equipement::class);
    }
}