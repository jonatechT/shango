<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Alerte extends Model
{
    use HasFactory, LogsActivity;

    /**
     * Table associée au modèle
     */
    protected $table = 'alertes';

    /**
     * Champs autorisés
     */
    protected $fillable = [
        'equipement_id',
        'device_id',
        'type_alerte',
        'gravite',
        'valeur',
        'horodatage',
        'statut',
    ];

    /**
     * Conversion automatique des types
     */
    protected $casts = [
        'valeur' => 'decimal:2',
        'horodatage' => 'datetime',
    ];

    /**
     * Une alerte appartient à un équipement
     */
    public function equipement(): BelongsTo
    {
        return $this->belongsTo(Equipement::class);
    }
}