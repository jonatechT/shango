import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { TOKEN_KEY as STORAGE_TOKEN_KEY, USER_KEY as STORAGE_USER_KEY } from '../core/storage-keys';

export type UserRole = 'SUPERADMIN' | 'ADMIN_STRUCTURE' | 'USER';
export type UserStatut = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  structureId?: string;
  statut?: UserStatut;
  telephone?: string;
  dateCreation?: string;
  motDePasse?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = STORAGE_TOKEN_KEY;
  private readonly USERS_CURRENT_VERSION = '4';

  /** Profil personnalisé du SuperAdmin (nom/email/téléphone/mot de passe modifiés depuis son profil) */
  private readonly SUPER_PROFILE_KEY = 'shango_superadmin_profile';
  private readonly USER_KEY = STORAGE_USER_KEY;
  private readonly USERS_REGISTRY_KEY = 'shango_users';
  private readonly USERS_VERSION_KEY = 'shango_users_version';

  /** Version de la session de connexion (clé séparée du registre des comptes) */
  private readonly SESSION_VERSION_KEY = 'shango_session_version';
  private readonly SESSION_CURRENT_VERSION = '2';

  /** Rôles valides — toute session avec un autre rôle est considérée obsolète */
  private readonly VALID_ROLES: UserRole[] = ['SUPERADMIN', 'ADMIN_STRUCTURE', 'USER'];

  isLoggedIn = signal<boolean>(this.hasToken());

  constructor(private http: HttpClient) {
    this.seedDemoUsers();
    this.migrateSession();
  }

  /** Traduit le rôle du backend (`superadmin`/`admin`/`technicien`) vers le rôle UI. */
  private mapBackendRole(role: string): UserRole {
    switch (role) {
      case 'superadmin': return 'SUPERADMIN';
      case 'admin': return 'ADMIN_STRUCTURE';
      default: return 'USER';
    }
  }

  /** Traduit le statut du backend (`actif`/`inactif`) vers le statut UI. */
  private mapBackendStatus(status: string | null | undefined): UserStatut {
    return status === 'inactif' ? 'INACTIVE' : 'ACTIVE';
  }

  /** Convertit un utilisateur renvoyé par l'API (`/api/login`, `/api/me`) au format UI. */
  private mapBackendUser(raw: any): User {
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      role: this.mapBackendRole(raw.role),
      structureId: raw.organization_id != null ? String(raw.organization_id) : undefined,
      statut: this.mapBackendStatus(raw.status),
      telephone: raw.phone ?? undefined,
      dateCreation: raw.created_at ?? undefined
    };
  }

  /** Message d'erreur lisible à partir d'une réponse d'erreur HTTP du backend. */
  private extractErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "Backend indisponible : impossible de se connecter au serveur.";
    }
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    const firstFieldError = errors ? Object.values(errors)[0]?.[0] : undefined;
    const backendMessage = error.error?.message || firstFieldError;
    return backendMessage || `Erreur ${error.status} lors de la connexion.`;
  }

  /** Comptes de démonstration pour les structures */
  private seedDemoUsers(): void {
    if (typeof window === 'undefined') return;
    const version = localStorage.getItem(this.USERS_VERSION_KEY);
    if (version === this.USERS_CURRENT_VERSION) return;

    const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
    const registered: User[] = raw ? JSON.parse(raw) : [];

    const demoUsers: User[] = [
      {
        id: 1,
        name: 'Admin Alioth',
        email: 'admin@alioth-system.com',
        role: 'ADMIN_STRUCTURE',
        structureId: 'STR-001',
        statut: 'ACTIVE',
        telephone: '+226 70 98 76 54',
        dateCreation: '2024-03-20T10:00:00.000Z',
        motDePasse: 'alioth2024'
      },
      {
        id: 2,
        name: 'Admin Orange',
        email: 'admin@orange-energie.com',
        role: 'ADMIN_STRUCTURE',
        structureId: 'STR-002',
        statut: 'ACTIVE',
        telephone: '+226 70 12 34 56',
        dateCreation: '2024-01-15T10:00:00.000Z',
        motDePasse: 'orange2024'
      },
      {
        id: 3,
        name: 'M. Ouedraogo',
        email: 'mamadou@shango.com',
        role: 'USER',
        structureId: 'STR-001',
        statut: 'ACTIVE',
        telephone: '+226 70 11 22 33',
        dateCreation: '2024-04-10T10:00:00.000Z',
        motDePasse: 'technicien123'
      },
      {
        id: 4,
        name: 'M. Traore',
        email: 'traore@shango.com',
        role: 'USER',
        structureId: 'STR-001',
        statut: 'ACTIVE',
        telephone: '+226 76 44 55 66',
        dateCreation: '2024-05-12T10:00:00.000Z',
        motDePasse: 'technicien123'
      },
      {
        id: 5,
        name: 'M. Sanogo',
        email: 'sanogo@shango.com',
        role: 'USER',
        structureId: 'STR-002',
        statut: 'ACTIVE',
        telephone: '+226 71 77 88 99',
        dateCreation: '2024-06-18T10:00:00.000Z',
        motDePasse: 'technicien123'
      },
      {
        id: 6,
        name: 'Mme Kaboré',
        email: 'kabore@shango.com',
        role: 'USER',
        structureId: 'STR-001',
        statut: 'ACTIVE',
        telephone: '+226 70 22 33 44',
        dateCreation: '2024-07-05T10:00:00.000Z',
        motDePasse: 'technicien123'
      },
      {
        id: 7,
        name: 'M. Zongo',
        email: 'zongo@shango.com',
        role: 'USER',
        structureId: 'STR-002',
        statut: 'ACTIVE',
        telephone: '+226 76 88 99 00',
        dateCreation: '2024-08-14T10:00:00.000Z',
        motDePasse: 'technicien123'
      },
      {
        id: 8,
        name: 'OUEDRAOGO Ali',
        email: 'ali@shango.com',
        role: 'USER',
        structureId: 'STR-001',
        statut: 'ACTIVE',
        telephone: '+226 70 00 00 00',
        dateCreation: '2024-02-10T10:00:00.000Z',
        motDePasse: 'ali2024'
      }
    ];

    demoUsers.forEach(demo => {
      const existing = registered.find(u => u.email.toLowerCase() === demo.email.toLowerCase());
      if (existing) {
        Object.assign(existing, demo);
      } else {
        registered.push(demo);
      }
    });

    localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(registered));
    localStorage.setItem(this.USERS_VERSION_KEY, this.USERS_CURRENT_VERSION);
  }

  private hasToken(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem(this.TOKEN_KEY);
    }
    return false;
  }

  /**
   * Migration de la session de connexion.
   * localStorage est propre à chaque origine : la session en ligne
   * (GitHub Pages) peut provenir d'un ancien déploiement avec une forme
   * de données obsolète (rôle absent/invalide), ce qui faisait disparaître
   * les actions réservées aux admins alors que tout fonctionnait en local.
   * Toute session sans version courante ou de forme invalide est purgée :
   * l'utilisateur se reconnecte et obtient un rôle fiable.
   */
  private migrateSession(): void {
    if (typeof window === 'undefined') return;
    const version = localStorage.getItem(this.SESSION_VERSION_KEY);
    if (version === this.SESSION_CURRENT_VERSION) return;

    const raw = localStorage.getItem(this.USER_KEY);
    if (raw) {
      try {
        const user = JSON.parse(raw) as User;
        if (!user || !this.VALID_ROLES.includes(user.role)) {
          this.clearInvalidSession();
        }
      } catch {
        this.clearInvalidSession();
      }
    }
    localStorage.setItem(this.SESSION_VERSION_KEY, this.SESSION_CURRENT_VERSION);
  }

  /** Purge une session obsolète ou corrompue. */
  private clearInvalidSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    this.isLoggedIn.set(false);
  }

  /** Utilisateur actuellement connecté */
  get currentUser(): User | null {
    return this.getUser();
  }

  /** Rôle de l'utilisateur connecté */
  get role(): UserRole | null {
    return this.getUser()?.role ?? null;
  }

  /** Structure de l'utilisateur connecté (ADMIN_STRUCTURE ou USER) */
  get structureId(): string | null {
    return this.getUser()?.structureId ?? null;
  }

  /**
   * Connexion — POST /api/login (backend Laravel/Sanctum).
   *
   * `pending` reste toujours `false` : le backend n'a pas (encore) de statut
   * de compte "en attente de validation" (voir `RegisterComponent`, dont
   * l'inscription libre n'est pas encore connectée à une API réelle).
   */
  login(email: string, password: string): Observable<{ success: boolean; pending: boolean; message?: string }> {
    return this.http
      .post<{ user: any; token: string }>(`${environment.apiUrl}/login`, { email, password })
      .pipe(
        map(response => {
          const user = this.mapBackendUser(response.user);
          localStorage.setItem(this.TOKEN_KEY, response.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
          this.isLoggedIn.set(true);
          return { success: true, pending: false };
        }),
        catchError((error: HttpErrorResponse) =>
          of({ success: false, pending: false, message: this.extractErrorMessage(error) })
        )
      );
  }

  /**
   * Récupère l'utilisateur authentifié depuis le backend (GET /api/me) et
   * rafraîchit la session locale. Utile pour valider/actualiser la session
   * au démarrage de l'application sans forcer une reconnexion.
   */
  refreshCurrentUser(): Observable<User | null> {
    if (!this.hasToken()) return of(null);
    return this.http.get<any>(`${environment.apiUrl}/me`).pipe(
      map(raw => {
        const user = this.mapBackendUser(raw);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        return user;
      }),
      catchError(() => of(null))
    );
  }

  /** Récupérer tous les comptes en attente de validation (vue globale superadmin) */
  getPendingUsers(): User[] {
    return this.getAllUsers().filter(u => u.statut === 'PENDING');
  }

  /** Valider un compte en attente (admin uniquement) */
  validerCompte(userId: number): void {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      const registered: User[] = raw ? JSON.parse(raw) : [];
      const target = registered.find(u => u.id === userId);
      if (target) {
        target.statut = 'ACTIVE';
        localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(registered));
      }
    }
  }

  /** Rejeter un compte en attente (suppression définitive) */
  rejeterCompte(userId: number): void {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      const registered: User[] = raw ? JSON.parse(raw) : [];
      const filtered = registered.filter(u => u.id !== userId);
      localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(filtered));
    }
  }

  /** Enregistrer un utilisateur créé par le SuperAdmin ou l'Admin de structure */
  registerUser(user: User): void {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      const registered = raw ? JSON.parse(raw) : [];
      const existing = registered.find(
        (u: User) => u.email.toLowerCase() === user.email.toLowerCase()
      );
      if (existing) {
        Object.assign(existing, user);
      } else {
        registered.push(user);
      }
      localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(registered));
    }
  }

  /** Récupérer tous les utilisateurs enregistrés (hors superadmin) */
  getAllUsers(): User[] {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      const users: User[] = raw ? JSON.parse(raw) : [];
      return users.filter((u: User) => u.role !== 'SUPERADMIN');
    }
    return [];
  }

  /** Récupérer les utilisateurs d'une structure donnée */
  getUsersByStructure(structureId: string): User[] {
    return this.getAllUsers().filter(u => u.structureId === structureId);
  }

  /** Profil personnalisé persisté du SuperAdmin (informations modifiées depuis son profil) */
  getSuperAdminProfile(): Partial<User> | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.SUPER_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Partial<User>) : null;
  }

  /** Modifier les informations du SuperAdmin (persistées + session rafraîchie immédiatement) */
  updateSuperAdminProfile(data: { name?: string; email?: string; telephone?: string; motDePasse?: string }): void {
    if (typeof window === 'undefined') return;
    const clean: Partial<User> = {};
    if (data.name && data.name.trim()) clean.name = data.name.trim();
    if (data.email && data.email.trim()) clean.email = data.email.trim().toLowerCase();
    if (data.telephone !== undefined) clean.telephone = data.telephone.trim();
    if (data.motDePasse && data.motDePasse.trim()) clean.motDePasse = data.motDePasse;
    localStorage.setItem(this.SUPER_PROFILE_KEY, JSON.stringify(clean));
    // La session en cours est rafraîchie sans déconnexion
    const current = this.getUser();
    if (current?.role === 'SUPERADMIN') {
      localStorage.setItem(this.USER_KEY, JSON.stringify({ ...current, ...clean }));
    }
  }

  /**
   * Modifier les informations de l'utilisateur connecté (admin ou technicien).
   * Met à jour le registre des comptes ET la session courante.
   */
  updateCurrentUser(data: Partial<User>): boolean {
    if (typeof window === 'undefined') return false;
    const current = this.getUser();
    if (!current) return false;
    const updated: User = { ...current, ...data };
    if (current.role !== 'SUPERADMIN') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      const registered: User[] = raw ? JSON.parse(raw) : [];
      const currentEmail = current.email.toLowerCase();
      let found = false;
      for (let i = 0; i < registered.length; i++) {
        if (registered[i].email.toLowerCase() === currentEmail) {
          registered[i] = { ...registered[i], ...updated };
          found = true;
          break;
        }
      }
      if (!found) {
        registered.push(updated);
      }
      localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(registered));
    }
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    return true;
  }

  hasRole(role: UserRole): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  isSuperAdmin(): boolean {
    return this.hasRole('SUPERADMIN');
  }

  isStructureAdmin(): boolean {
    return this.hasRole('ADMIN_STRUCTURE');
  }

  isUser(): boolean {
    return this.hasRole('USER');
  }

  logout(): void {
    // Révocation du token côté backend en best-effort : la session locale est
    // nettoyée immédiatement quel que soit le résultat de l'appel.
    if (this.hasToken()) {
      this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.isLoggedIn.set(false);
  }

  getUser(): User | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (!userStr) return null;
      try {
        const user = JSON.parse(userStr) as User;
        if (!user || !this.VALID_ROLES.includes(user.role)) {
          // Session de forme inconnue (ancien déploiement) : invalide
          this.clearInvalidSession();
          return null;
        }
        return user;
      } catch {
        this.clearInvalidSession();
        return null;
      }
    }
    return null;
  }
}