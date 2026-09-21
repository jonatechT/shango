<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Intervention extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'maintenance_id',
        'equipement_id',
        'technicien_id',
        'date_intervention',
        'diagnostic',
        'actions_realisees',
        'pieces_utilisees',
        'etat_equipement_apres',
        'commentaire',
        'status',
    ];

    protected $casts = [
        'date_intervention' => 'datetime',
        'pieces_utilisees' => 'array',
        'status' => 'string',
    ];

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(Maintenance::class);
    }

    public function equipement(): BelongsTo
    {
        return $this->belongsTo(Equipement::class);
    }

    public function technicien(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technicien_id');
    }
}