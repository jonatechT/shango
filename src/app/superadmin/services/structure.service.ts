import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { Structure, StructureStats, StructureStatus } from '../models/structure.model';
import { environment } from '../../../environments/environment';
import { extractHttpErrorMessage } from '../../core/http-error';

export interface StructureInput {
  nom: string;
  code?: string;
  description: string;
  email?: string;
  telephone?: string;
  adresse: string;
  ville?: string;
  pays?: string;
  statut: StructureStatus;
  adminNom?: string;
  adminEmail?: string;
  adminTelephone?: string;
  adminMotDePasse?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StructureService {
  private http = inject(HttpClient);

  structures = signal<Structure[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  /** Recharge la liste des structures depuis le backend (GET /api/organizations). */
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<{ data: any[] }>(`${environment.apiUrl}/organizations`).pipe(
      map(res => res.data.map(o => this.mapOrganization(o))),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, 'de charger les structures'));
        return of<Structure[]>([]);
      })
    ).subscribe(list => {
      this.structures.set(list);
      this.loading.set(false);
    });
  }

  private mapOrganization(raw: any): Structure {
    const admin = (raw.users ?? []).find((u: any) => u.role === 'admin');
    return {
      id: String(raw.id),
      nom: raw.name,
      code: raw.code ?? '',
      description: raw.description ?? '',
      email: raw.email ?? '',
      telephone: raw.phone ?? '',
      adresse: raw.address ?? '',
      ville: raw.city ?? '',
      pays: raw.country ?? '',
      statut: raw.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
      dateCreation: raw.created_at ?? '',
      dateModification: raw.updated_at ?? '',
      adminNom: admin?.name,
      adminEmail: admin?.email,
      adminTelephone: admin?.phone
    };
  }

  getAllStructures(): Structure[] {
    return this.structures();
  }

  getStructure(id: string): Structure | undefined {
    return this.structures().find(s => s.id === id);
  }

  getStats(): StructureStats {
    const structures = this.structures();
    const actives = structures.filter(s => s.statut === 'ACTIVE').length;
    return {
      total: structures.length,
      actives,
      inactives: structures.length - actives,
      // Comptage global des utilisateurs : à dériver de UsersService côté appelant
      // (cette valeur n'est pas recalculée ici pour éviter une dépendance circulaire).
      totalUtilisateurs: 0,
      utilisateursActifs: 0
    };
  }

  /**
   * Crée une structure puis, si les informations admin sont renseignées, son
   * administrateur (POST /api/organizations, puis POST /api/users role=admin).
   * Si la création de l'admin échoue, la structure reste créée : l'erreur est
   * exposée via `error` sans annuler l'organisation déjà créée côté backend.
   */
  createStructure(data: StructureInput): Observable<Structure | null> {
    this.error.set(null);
    const payload = {
      name: data.nom,
      code: data.code || undefined,
      description: data.description,
      email: data.email || undefined,
      phone: data.telephone || undefined,
      address: data.adresse,
      city: data.ville || undefined,
      country: data.pays || undefined,
      status: data.statut === 'INACTIVE' ? 'inactive' : 'active'
    };

    return this.http.post<{ data: any }>(`${environment.apiUrl}/organizations`, payload).pipe(
      switchMap(orgRes => {
        const org = orgRes.data;
        if (!data.adminEmail || !data.adminMotDePasse) {
          this.load();
          return of(this.mapOrganization(org));
        }
        return this.http.post(`${environment.apiUrl}/users`, {
          name: data.adminNom,
          email: data.adminEmail,
          password: data.adminMotDePasse,
          role: 'admin',
          organization_id: org.id,
          phone: data.adminTelephone,
          status: 'actif'
        }).pipe(
          map(() => {
            this.load();
            return this.mapOrganization(org);
          }),
          catchError((error: HttpErrorResponse) => {
            this.load();
            this.error.set(
              `Structure créée, mais échec de création de l'administrateur : ${extractHttpErrorMessage(error, "de créer l'administrateur")}`
            );
            return of(this.mapOrganization(org));
          })
        );
      }),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, 'de créer la structure'));
        return of(null);
      })
    );
  }

  /**
   * Modifie une structure et, si des informations admin sont fournies, son
   * administrateur associé (créé s'il n'existait pas encore, sinon mis à jour).
   */
  updateStructure(id: string, changes: Partial<StructureInput>): Observable<Structure | null> {
    this.error.set(null);
    const payload: Record<string, unknown> = {};
    if (changes.nom !== undefined) payload['name'] = changes.nom;
    if (changes.code !== undefined) payload['code'] = changes.code || null;
    if (changes.description !== undefined) payload['description'] = changes.description;
    if (changes.email !== undefined) payload['email'] = changes.email || null;
    if (changes.telephone !== undefined) payload['phone'] = changes.telephone || null;
    if (changes.adresse !== undefined) payload['address'] = changes.adresse;
    if (changes.ville !== undefined) payload['city'] = changes.ville || null;
    if (changes.pays !== undefined) payload['country'] = changes.pays || null;
    if (changes.statut !== undefined) payload['status'] = changes.statut === 'INACTIVE' ? 'inactive' : 'active';

    return this.http.put<{ data: any }>(`${environment.apiUrl}/organizations/${id}`, payload).pipe(
      // Ré-interroge l'organisation avec ses utilisateurs (PUT ne les renvoie pas)
      // pour retrouver l'admin existant sans risquer d'en créer un doublon.
      switchMap(() => this.http.get<{ data: any }>(`${environment.apiUrl}/organizations/${id}`)),
      switchMap(orgRes => {
        const org = orgRes.data;
        const wantsAdminChange = !!(changes.adminNom || changes.adminEmail || changes.adminMotDePasse);
        if (!wantsAdminChange) {
          this.load();
          return of(this.mapOrganization(org));
        }

        const existingAdmin = (org.users ?? []).find((u: any) => u.role === 'admin');
        if (existingAdmin) {
          const adminBody: Record<string, unknown> = {};
          if (changes.adminNom) adminBody['name'] = changes.adminNom;
          if (changes.adminEmail) adminBody['email'] = changes.adminEmail;
          if (changes.adminMotDePasse) adminBody['password'] = changes.adminMotDePasse;
          if (changes.adminTelephone !== undefined) adminBody['phone'] = changes.adminTelephone;
          return this.http.put(`${environment.apiUrl}/users/${existingAdmin.id}`, adminBody).pipe(
            map(() => { this.load(); return this.mapOrganization(org); }),
            catchError((error: HttpErrorResponse) => {
              this.load();
              this.error.set(`Structure modifiée, mais échec de mise à jour de l'administrateur : ${extractHttpErrorMessage(error, "de modifier l'administrateur")}`);
              return of(this.mapOrganization(org));
            })
          );
        }

        if (changes.adminNom && changes.adminEmail && changes.adminMotDePasse) {
          return this.http.post(`${environment.apiUrl}/users`, {
            name: changes.adminNom,
            email: changes.adminEmail,
            password: changes.adminMotDePasse,
            role: 'admin',
            organization_id: org.id,
            phone: changes.adminTelephone,
            status: 'actif'
          }).pipe(
            map(() => { this.load(); return this.mapOrganization(org); }),
            catchError((error: HttpErrorResponse) => {
              this.load();
              this.error.set(`Structure modifiée, mais échec de création de l'administrateur : ${extractHttpErrorMessage(error, "de créer l'administrateur")}`);
              return of(this.mapOrganization(org));
            })
          );
        }

        this.load();
        return of(this.mapOrganization(org));
      }),
      catchError((error: HttpErrorResponse) => {
        this.error.set(extractHttpErrorMessage(error, 'de modifier la structure'));
        return of(null);
      })
    );
  }

  toggleStatus(id: string): Observable<Structure | null> {
    const current = this.getStructure(id);
    if (!current) return of(null);
    const newStatus: StructureStatus = current.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateStructure(id, { statut: newStatus });
  }
}
