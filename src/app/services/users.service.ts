import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { User } from '../auth/auth.service';
import { environment } from '../../environments/environment';
import { mapBackendUser, toBackendRole, toBackendStatus } from '../core/user-mapper';
import { extractHttpErrorMessage } from '../core/http-error';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);

  users = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  createError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  /** Recharge la liste des utilisateurs depuis le backend (GET /api/users). */
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ data: any[] }>(`${environment.apiUrl}/users`).pipe(
      map(res => res.data.map(mapBackendUser)),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, 'de charger les utilisateurs'));
        return of<User[]>([]);
      })
    ).subscribe(list => {
      this.users.set(list);
      this.loading.set(false);
    });
  }

  /** Tous les utilisateurs (hors superadmin) */
  getAllUsers(): User[] {
    return this.users().filter(u => u.role !== 'SUPERADMIN');
  }

  /** Utilisateurs d'une structure donnée */
  getUsersByStructure(structureId: string): User[] {
    return this.getAllUsers().filter(u => u.structureId === structureId);
  }

  /** Créer un utilisateur (technicien ou admin de structure) — POST /api/users */
  createUser(user: Omit<User, 'id' | 'dateCreation'> & { motDePasse?: string }): Observable<User | null> {
    this.createError.set(null);
    const body = {
      name: user.name,
      email: user.email,
      password: user.motDePasse,
      role: toBackendRole(user.role),
      organization_id: user.structureId ? Number(user.structureId) : null,
      phone: user.telephone,
      status: toBackendStatus(user.statut)
    };
    return this.http.post<{ data: any }>(`${environment.apiUrl}/users`, body).pipe(
      map(res => {
        const created = mapBackendUser(res.data);
        this.users.set([...this.users(), created]);
        return created;
      }),
      catchError((error: HttpErrorResponse) => {
        this.createError.set(extractHttpErrorMessage(error, "de créer l'utilisateur"));
        return of(null);
      })
    );
  }

  /** Mettre à jour un utilisateur — PUT /api/users/{id} */
  updateUser(id: number, changes: Partial<User>): Observable<User | null> {
    const body: Record<string, unknown> = {};
    if (changes.name !== undefined) body['name'] = changes.name;
    if (changes.email !== undefined) body['email'] = changes.email;
    if (changes.motDePasse) body['password'] = changes.motDePasse;
    if (changes.role !== undefined) body['role'] = toBackendRole(changes.role);
    if (changes.structureId !== undefined) body['organization_id'] = changes.structureId ? Number(changes.structureId) : null;
    if (changes.telephone !== undefined) body['phone'] = changes.telephone;
    if (changes.statut !== undefined) body['status'] = toBackendStatus(changes.statut);

    return this.http.put<{ data: any }>(`${environment.apiUrl}/users/${id}`, body).pipe(
      map(res => {
        const updated = mapBackendUser(res.data);
        this.users.set(this.users().map(u => (u.id === id ? updated : u)));
        return updated;
      }),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, "de modifier l'utilisateur"));
        return of(null);
      })
    );
  }

  /** Activer/désactiver un utilisateur */
  toggleStatus(id: number): Observable<User | null> {
    const user = this.users().find(u => u.id === id);
    if (!user) return of(null);
    const newStatus = user.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateUser(id, { statut: newStatus });
  }

  /** Supprimer un utilisateur — DELETE /api/users/{id} */
  deleteUser(id: number): Observable<boolean> {
    return this.http.delete(`${environment.apiUrl}/users/${id}`).pipe(
      map(() => {
        this.users.set(this.users().filter(u => u.id !== id));
        return true;
      }),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, "de supprimer l'utilisateur"));
        return of(false);
      })
    );
  }

  /** Recharger les utilisateurs depuis le backend */
  reload(): void {
    this.load();
  }
}
