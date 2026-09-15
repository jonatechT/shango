# BACKEND API CONTRACT — SHANGO

Ce document définit le contrat entre le frontend et le futur backend.

## Authentification

### POST /api/auth/login

**Rôle** : Public

**Request** :
```json
{
  "email": "admin@structure.com",
  "password": "motdepasse"
}
```

**Response 200** :
```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": 1,
    "name": "Admin A",
    "email": "admin@structure.com",
    "role": "ADMIN_STRUCTURE",
    "structureId": "STR-001"
  }
}
```

**Erreurs** :
- 401 : Identifiants incorrects
- 403 : Compte désactivé

### POST /api/auth/register

**Rôle** : Public

**Request** :
```json
{
  "name": "User A1",
  "email": "user@structure.com",
  "password": "motdepasse",
  "structureId": "STR-001"
}
```

**Note** : Le `structureId` est choisi par l'utilisateur parmi les structures
déjà enregistrées sur la plateforme (liste déroulante). Le compte est créé avec
le statut `PENDING` et la demande de validation est envoyée à l'administrateur
de la structure concernée.

**Response 201** :
```json
{
  "id": 2,
  "name": "User A1",
  "email": "user@structure.com",
  "role": "USER",
  "structureId": "STR-001",
  "statut": "PENDING"
}
```

## Structures

### GET /api/structures

**Rôle** : SUPERADMIN

**Response 200** :
```json
[
  {
    "id": "STR-001",
    "nom": "Centre de Santé ABC",
    "code": "CS-ABC-001",
    "description": "...",
    "email": "contact@cs-abc.com",
    "telephone": "+226 25 40 12 34",
    "adresse": "12 Avenue de la Santé",
    "ville": "Ouagadougou",
    "pays": "Burkina Faso",
    "statut": "ACTIVE",
    "dateCreation": "2024-01-15T10:00:00.000Z",
    "dateModification": "2024-01-15T10:00:00.000Z"
  }
]
```

### POST /api/structures

**Rôle** : SUPERADMIN

**Request** :
```json
{
  "nom": "Centre de Santé ABC",
  "code": "CS-ABC-001",
  "description": "...",
  "email": "contact@cs-abc.com",
  "telephone": "+226 25 40 12 34",
  "adresse": "12 Avenue de la Santé",
  "ville": "Ouagadougou",
  "pays": "Burkina Faso",
  "statut": "ACTIVE"
}
```

**Response 201** : Structure créée

### GET /api/structures/:id

**Rôle** : SUPERADMIN

**Response 200** : Structure

### PUT /api/structures/:id

**Rôle** : SUPERADMIN

**Request** : Champs partiels à modifier

**Response 200** : Structure modifiée

### PATCH /api/structures/:id/status

**Rôle** : SUPERADMIN

**Request** :
```json
{
  "statut": "INACTIVE"
}
```

**Response 200** : Structure mise à jour

## Utilisateurs

### GET /api/users

**Rôle** : SUPERADMIN (tous) / ADMIN_STRUCTURE (sa structure uniquement)

**Query params** : `?structureId=STR-001`

**Response 200** :
```json
[
  {
    "id": 2,
    "name": "User A1",
    "email": "user@structure.com",
    "role": "USER",
    "structureId": "STR-001",
    "statut": "ACTIVE",
    "telephone": "+226 70 12 34 56",
    "dateCreation": "2024-05-01T10:00:00.000Z"
  }
]
```

### POST /api/users

**Rôle** : ADMIN_STRUCTURE (création USER uniquement) / SUPERADMIN

**Request** :
```json
{
  "name": "User A1",
  "email": "user@structure.com",
  "telephone": "+226 70 12 34 56",
  "motDePasse": "temporaire123",
  "statut": "ACTIVE",
  "structureId": "STR-001"
}
```

**Note** : Le rôle est imposé par le backend = `USER`

**Response 201** : Utilisateur créé

### PATCH /api/users/:id/status

**Rôle** : ADMIN_STRUCTURE (sa structure uniquement) / SUPERADMIN

**Request** :
```json
{
  "statut": "INACTIVE"
}
```

**Response 200** : Utilisateur mis à jour

## Règles de sécurité

1. Un ADMIN_STRUCTURE ne peut voir que les utilisateurs de SA structure
2. Un ADMIN_STRUCTURE ne peut créer que des comptes USER
3. Un ADMIN_STRUCTURE ne peut pas désactiver un SUPERADMIN ou un autre ADMIN_STRUCTURE
4. Un USER ne peut pas accéder à `/api/users`
5. Le `structureId` est toujours déterminé par le backend, jamais par le client