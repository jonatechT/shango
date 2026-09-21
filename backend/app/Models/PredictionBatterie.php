<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PredictionBatterie extends Model
{
    protected $table = 'predictions_batteries';

    protected $fillable = [
        'device_id',
        'date_heure',
        'voltage_v',
        'current_a',
        'temperature_c',
        'dod_percent',

        // Anciennes données IA
        'soh_pourcent',
        'capacite_ah',
        'rul_jours',

        // Nouveaux résultats du modèle IA
        'soh_class',
        'soh_class_id',
        'soh_probabilities',
        'confidence',
        'rul_cycles',

        // État de la batterie
        'etat',
    ];

    protected $casts = [
        'date_heure' => 'datetime',

        // Données reçues
        'voltage_v' => 'float',
        'current_a' => 'float',
        'temperature_c' => 'float',
        'dod_percent' => 'float',

        // Anciennes données IA
        'soh_pourcent' => 'float',
        'capacite_ah' => 'float',
        'rul_jours' => 'float',

        // Nouveaux résultats IA
        'soh_class_id' => 'integer',
        'soh_probabilities' => 'array',
        'confidence' => 'float',
        'rul_cycles' => 'integer',
    ];
}
