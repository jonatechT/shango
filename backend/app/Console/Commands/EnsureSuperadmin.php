<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class EnsureSuperadmin extends Command
{
    protected $signature = 'shango:ensure-superadmin {email} {password}';

    protected $description = "Crée le compte superadmin s'il n'existe pas (ne modifie jamais un compte existant).";

    public function handle(): int
    {
        $email = $this->argument('email');

        if (User::where('email', $email)->exists()) {
            $this->info("Le compte {$email} existe déjà, rien à faire.");

            return self::SUCCESS;
        }

        // Mot de passe haché par le cast 'hashed' du modèle User.
        User::create([
            'name' => 'Super Admin',
            'email' => $email,
            'password' => $this->argument('password'),
            'role' => 'superadmin',
            'status' => 'actif',
        ]);

        $this->info("Superadmin {$email} créé.");

        return self::SUCCESS;
    }
}
