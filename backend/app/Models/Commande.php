<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Commande extends Model
{
    use HasFactory, LogsActivity;

    /**
     * Table associée au modèle
     */
    protected $table = 'commandes';

    /**
     * Champs autorisés
     */
    protected $fillable = [
        'equipement_id',
        'device_id',
        'commande',
        'emis_par',
        'raison',
        'statut',
        'reponse_bridge',
    ];

    /**
     * Conversion automatique des types
     */
    protected $casts = [
        'equipement_id' => 'integer',
    ];

    /**
     * Une commande appartient à un équipement
     */
    public function equipement(): BelongsTo
    {
        return $this->belongsTo(Equipement::class);
    }
}