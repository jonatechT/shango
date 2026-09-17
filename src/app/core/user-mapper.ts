import { User, UserRole, UserStatut } from '../auth/auth.service';

/** Traduit le rôle du backend (`superadmin`/`admin`/`technicien`) vers le rôle UI. */
export function mapBackendRole(role: string): UserRole {
  switch (role) {
    case 'superadmin': return 'SUPERADMIN';
    case 'admin': return 'ADMIN_STRUCTURE';
    default: return 'USER';
  }
}

/** Traduit le rôle UI vers la valeur attendue par le backend. */
export function toBackendRole(role: UserRole): 'superadmin' | 'admin' | 'technicien' {
  switch (role) {
    case 'SUPERADMIN': return 'superadmin';
    case 'ADMIN_STRUCTURE': return 'admin';
    default: return 'technicien';
  }
}

/** Traduit le statut du backend (`actif`/`inactif`) vers le statut UI. */
export function mapBackendStatus(status: string | null | undefined): UserStatut {
  return status === 'inactif' ? 'INACTIVE' : 'ACTIVE';
}

/** Traduit le statut UI vers la valeur attendue par le backend (pas d'équivalent pour PENDING). */
export function toBackendStatus(status: UserStatut | undefined): 'actif' | 'inactif' {
  return status === 'INACTIVE' ? 'inactif' : 'actif';
}

/** Convertit un utilisateur renvoyé par l'API (`/api/users`, `/api/organizations`) au format UI. */
export function mapBackendUser(raw: any): User {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: mapBackendRole(raw.role),
    structureId: raw.organization_id != null ? String(raw.organization_id) : undefined,
    statut: mapBackendStatus(raw.status),
    telephone: raw.phone ?? undefined,
    dateCreation: raw.created_at ?? undefined
  };
}
