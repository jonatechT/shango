<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Equipement extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'organization_id',
        'type',
        'reference',
        'nom',
        'description',
        'client_nom',
        'client_numero',
        'marque_modele',
        'site',
        'photo',
        'perimetre_metres',
        'technicien_id',
        'status',
        'installed_at',
        'device_id',
        'etat_kit',
    ];

    protected $casts = [
        'installed_at' => 'date',
        'status' => 'string',
        'etat_kit' => 'string',
        'perimetre_metres' => 'decimal:2',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function technicien(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technicien_id');
    }

    public function localisations(): HasMany
    {
        return $this->hasMany(Localisation::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(Maintenance::class);
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class);
    }

    public function telemetries(): HasMany
    {
        return $this->hasMany(Telemetrie::class);
    }

    public function alertes(): HasMany
    {
        return $this->hasMany(Alerte::class);
    }
}