# FRONTEND ARCHITECTURE — SHANGO

## 1. Architecture globale

```
                    SHANGO
                         │
             ┌───────────┴───────────┐
             │                       │
        SUPERADMIN              STRUCTURE
             │                       │
             │                 ADMIN_STRUCTURE
             │                       │
             │                ┌──────┴──────┐
             │                │             │
             │             Gestion       Utilisateurs
             │             structure     de la structure
             │
             └── Création des structures
                 + création initiale
                   de leur administrateur
```

## 2. Rôles

| Rôle | Description |
|------|-------------|
| **SUPERADMIN** | Gère la plateforme entière : structures, utilisateurs globaux |
| **ADMIN_STRUCTURE** | Appartient à UNE structure, gère les utilisateurs de SA structure |
| **USER** | Utilisateur normal, accès aux fonctionnalités de base uniquement |

## 3. SUPERADMIN

- Crée / modifie / active / désactive les structures
- Crée / affecte l'administrateur de structure
- Consulte les utilisateurs globalement
- Accès : `/superadmin`

## 4. ADMIN_STRUCTURE

- Accède au dashboard
- Voit les informations de sa structure
- Accède à `/users` (gestion des utilisateurs de SA structure)
- Crée des comptes USER (rôle imposé = USER, structureId imposé)
- Désactive/active les utilisateurs de SA structure
- Ne peut PAS accéder à `/superadmin`

## 5. USER

- Accède au dashboard
- Utilise les fonctionnalités de base
- Ne peut PAS accéder à `/users`

## 6. Structures

- Chaque structure a un `id` unique (ex: `STR-001`)
- Chaque ADMIN_STRUCTURE est lié à une structure via `structureId`
- Chaque USER est lié à une structure via `structureId`

## 7. Relation User → Structure

```
SUPERADMIN
    │
    ├── Structure A
    │      ├── Admin A (ADMIN_STRUCTURE, structureId = A)
    │      ├── User A1 (USER, structureId = A)
    │      └── User A2 (USER, structureId = A)
    │
    └── Structure B
           ├── Admin B (ADMIN_STRUCTURE, structureId = B)
           ├── User B1 (USER, structureId = B)
           └── User B2 (USER, structureId = B)
```

## 8. Routing

| Route | Rôle | Page |
|-------|------|------|
| `/login` | Public | Login |
| `/register` | Public | Register |
| `/dashboard` | Authentifié | Dashboard utilisateur |
| `/location` | Authentifié | Localisation |
| `/maintenance` | Authentifié | Maintenance |
| `/alerts` | Authentifié | Alertes |
| `/users` | ADMIN_STRUCTURE / SUPERADMIN | Gestion des utilisateurs de la structure |
| `/superadmin` | SUPERADMIN | Dashboard SuperAdmin |
| `/superadmin/structures` | SUPERADMIN | Liste des structures |
| `/superadmin/structures/new` | SUPERADMIN | Création de structure |
| `/superadmin/structures/:id` | SUPERADMIN | Détail structure |
| `/superadmin/structures/:id/edit` | SUPERADMIN | Modification structure |
| `/superadmin/users` | SUPERADMIN | Utilisateurs globaux |

## 9. Guards

| Guard | Rôle autorisé |
|-------|---------------|
| `authGuard` | Tout utilisateur authentifié |
| `structureAdminGuard` | ADMIN_STRUCTURE ou SUPERADMIN |
| `superAdminGuard` | SUPERADMIN uniquement |

## 10. Services

| Service | Responsabilités |
|---------|-----------------|
| `AuthService` | Authentification, rôle courant, structureId courant |
| `UsersService` | CRUD utilisateurs, filtrage par structure |
| `StructureService` | CRUD structures, statistiques |

## 11. Modèles

| Modèle | Définition |
|--------|------------|
| `User` | id, name, email, role, structureId, statut, telephone, dateCreation |
| `Structure` | id, nom, code, description, email, telephone, adresse, ville, pays, statut, dateCreation, dateModification |
| `UserRole` | `SUPERADMIN` \| `ADMIN_STRUCTURE` \| `USER` |
| `StructureStatus` | `ACTIVE` \| `INACTIVE` |

## 12. Gestion des utilisateurs

- L'ADMIN_STRUCTURE voit uniquement les utilisateurs de SA structure
- Le rôle est imposé par le système (USER)
- Le `structureId` est imposé par le système
- Désactivation/activation avec confirmation

## 13. Ce qui est actuellement mocké

- Authentification (localStorage)
- Persistance des structures (localStorage)
- Persistance des utilisateurs (localStorage)

## 14. Ce qui devra être remplacé par l'API backend

- `AuthService.login()` → `POST /api/auth/login`
- `UsersService.getAllUsers()` → `GET /api/users`
- `UsersService.createUser()` → `POST /api/users`
- `StructureService.getAllStructures()` → `GET /api/structures`
- `StructureService.createStructure()` → `POST /api/structures`

## 15. Endpoints backend attendus

Voir `BACKEND_API_CONTRACT.md` pour le contrat détaillé.