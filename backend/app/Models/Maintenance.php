<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Maintenance extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'equipement_id',
        'incident_id',
        'type',
        'requested_by',
        'validated_by',
        'assigned_to',
        'status',
        'scheduled_at',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'type' => 'string',
        'status' => 'string',
    ];

    public function equipement(): BelongsTo
    {
        return $this->belongsTo(Equipement::class);
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function assignedTechnicien(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class);
    }
}