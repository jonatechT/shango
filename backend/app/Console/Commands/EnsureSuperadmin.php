<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class EnsureSuperadmin extends Command
{
    protected $signature = 'shango:ensure-superadmin {email} {password} {--reset : Réinitialise le mot de passe si le compte existe déjà}';

    protected $description = "Crée le compte superadmin s'il n'existe pas (ne modifie un compte existant qu'avec --reset).";

    public function handle(): int
    {
        // Les valeurs viennent de variables d'environnement souvent collées avec un espace
        // ou un retour à la ligne parasite ; le login, lui, trim toujours ce qu'on saisit.
        $email = trim($this->argument('email'));
        $password = trim($this->argument('password'));

        $user = User::where('email', $email)->first();

        if ($user && ! $this->option('reset')) {
            $this->info("Le compte {$email} existe déjà, rien à faire.");

            return self::SUCCESS;
        }

        if ($user) {
            $user->update(['password' => $password, 'role' => 'superadmin', 'status' => 'actif']);
            $this->info("Superadmin {$email} : mot de passe réinitialisé.");

            return self::SUCCESS;
        }

        // Mot de passe haché par le cast 'hashed' du modèle User.
        User::create([
            'name' => 'Super Admin',
            'email' => $email,
            'password' => $password,
            'role' => 'superadmin',
            'status' => 'actif',
        ]);

        $this->info("Superadmin {$email} créé.");

        return self::SUCCESS;
    }
}
