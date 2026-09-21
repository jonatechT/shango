<?php

namespace App\Models;

use App\Models\Organization;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'email',
    'password',
    'role',
    'organization_id',
    'phone',
    'status',
])]
#[Hidden([
    'password',
    'remember_token',
])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => 'string',
            'organization_id' => 'integer',
            'status' => 'string',
        ];
    }

    /**
     * Organisation à laquelle appartient l'utilisateur.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Équipements dont l'utilisateur est le technicien responsable.
     */
    public function equipements(): HasMany
    {
        return $this->hasMany(Equipement::class, 'technicien_id');
    }

    /**
     * Incidents signalés par l'utilisateur.
     */
    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class, 'reported_by');
    }

    /**
     * Demandes de maintenance créées par l'utilisateur.
     */
    public function maintenancesRequested(): HasMany
    {
        return $this->hasMany(Maintenance::class, 'requested_by');
    }

    /**
     * Maintenances validées par l'utilisateur.
     */
    public function maintenancesValidated(): HasMany
    {
        return $this->hasMany(Maintenance::class, 'validated_by');
    }

    /**
     * Maintenances assignées à l'utilisateur.
     */
    public function maintenancesAssigned(): HasMany
    {
        return $this->hasMany(Maintenance::class, 'assigned_to');
    }

    /**
     * Interventions réalisées par le technicien.
     */
    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'technicien_id');
    }
}