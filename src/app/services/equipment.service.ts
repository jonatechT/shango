import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EQUIPMENT_API_CONFIG } from '../config/equipment-api.config';
import { mockBatteryCurrentDiagnostic, mockBatteryHistory, mockLocationHistory } from './equipment-mock-data';

/**
 * Modèle d'un équipement du parc.
 * Les données de localisation proviennent de la source existante (mock app.routes.ts).
 * NOTE BACKEND : temperature et tension ne sont pas encore fournies par l'API.
 * Ces champs sont prévus (null par défaut) pour accueillir les futures données capteurs.
 */
export interface Equipment {
  id: string;
  nom: string;
  statut: string;
  localisation: string;
  lienLocalisation: string;
  miseEnLigne: string;
  type: string;
  /**
   * Description libre saisie par le technicien à la déclaration.
   * Facultative — transmise au backend via POST /api/equipements.
   */
  description?: string;
  /** Non fourni par le backend actuellement — nécessite une source capteur */
  temperature: number | null;
  /** Non fourni par le backend actuellement — nécessite une source capteur */
  tension: number | null;
  /**
   * État de blocage de l'équipement.
   * Champ attendu du backend (liste des équipements) — absent = équipement actif.
   * Aucune valeur fictive n'est introduite côté frontend.
   */
  bloque?: boolean;
}

export interface EquipmentDiagnostic {
  etat: string;
  gravite: string;
  anomalie: string | null;
}

/**
 * Diagnostic batterie courant fourni par le backend :
 *   GET /api/batterie/{device_id}/actuel
 *
 * Aucune valeur n'est inventée côté frontend : le backend est l'unique source.
 * Les champs mesurés restent nullables tant qu'ils ne sont pas fournis.
 * La tension brute (`voltage_v`) est affichée telle quelle — aucune conversion
 * (ex. voltage / 4) n'est effectuée dans le frontend.
 */
export interface BatteryCurrentDiagnostic {
  device_id: string;
  /** Date/heure de la dernière analyse (ISO 8601). */
  date_heure: string;
  /** Tension brute du pack (V). */
  voltage_v: number | null;
  /** Courant de charge/décharge (A). */
  current_a: number | null;
  /** Température de la batterie (°C). */
  temperature_c: number | null;
  /** Profondeur de décharge (%). */
  dod_percent: number | null;
  /** État de santé / SOH (%). */
  soh_pourcent: number | null;
  /** Capacité restante (Ah). */
  capacite_restante_ah: number | null;
  /** Durée de vie estimée restante (jours). */
  duree_estimee_jours: number | null;
  /** Valeur fournie par le backend : 'Bon' | 'Surveiller' | 'À remplacer' (ou 'A_remplacer'). */
  etat: string | null;
  /** Message de maintenance fourni par le backend. */
  message: string | null;
}

/**
 * Point d'historique batterie fourni par le backend :
 *   GET /api/batterie/{device_id}/historique
 */
export interface BatteryHistoryEntry {
  date_heure: string;
  soh: number | null;
  capacite: number | null;
  rul_jours: number | null;
  temperature: number | null;
}

/**
 * Point d'historique de localisation fourni par le backend :
 *   GET /api/equipements/{id}/localisations
 *
 * Permet de reconstituer la timeline : « de tel heure le kit se trouvait ici,
 * de tel heure il se trouve là ». Aucune donnée n'est inventée côté frontend.
 */
export interface LocationHistoryEntry {
  /** Début de présence à cette position (ISO 8601). */
  date_debut: string;
  /** Fin de présence (ISO 8601) — null si c'est la position actuelle. */
  date_fin: string | null;
  /** Libellé ou coordonnées de la position. */
  localisation: string;
  /** Coordonnées « lat,long » utilisées pour le lien Google Maps. */
  lien_localisation: string;
}

@Injectable({ providedIn: 'root' })
export class EquipmentService {
  /**
   * Message d'erreur du dernier appel API batterie (null si aucun incident).
   * Consommé par les pages pour distinguer « backend indisponible » d'une
   * simple absence de données.
   */
  readonly batteryApiError = signal<string | null>(null);

  /**
   * Message d'erreur du dernier appel historique de localisation
   * (null si aucun incident ou simple absence de données 404).
   */
  readonly locationHistoryError = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  private readonly STORAGE_KEY = 'shango_equipments';

  /** Données identiques à celles affichées jusqu'ici dans le tableau du parc */
  private readonly defaultEquipments: Equipment[] = [
     { id: 'SH-001', nom: 'Kit solaire #SK-045', statut: 'En alerte', localisation: '12.3685°N, -1.5250°E', lienLocalisation: '12.3685,-1.5250', miseEnLigne: '14 mars 2024', type: 'Kit solaire', temperature: null, tension: null },
     { id: 'SH-002', nom: 'Kit solaire #SK-067', statut: 'En alerte', localisation: '11.1784°N, -4.2979°E', lienLocalisation: '11.1784,-4.2979', miseEnLigne: '22 janvier 2024', type: 'Kit solaire', temperature: null, tension: null },
     { id: 'SH-003', nom: 'Kit solaire #SK-089', statut: 'Inspection', localisation: '12.2513°N, -2.3510°E', lienLocalisation: '12.2513,-2.3510', miseEnLigne: '5 juin 2024', type: 'Kit solaire', temperature: null, tension: null },
     { id: 'SH-004', nom: 'Kit solaire #SK-102', statut: 'Inspection', localisation: '12.3714°N, -1.5197°E', lienLocalisation: '12.3714,-1.5197', miseEnLigne: '18 septembre 2023', type: 'Kit solaire', temperature: null, tension: null },
  ];

  /**
   * Liste du parc, persistée en localStorage (comme les autres registres
   * frontend) afin que les équipements ajoutés/amorcés pour une structure
   * (cf. `seedEquipment`) restent résolvables après un rechargement de page.
   */
  private equipments: Equipment[] = this.loadEquipments();

  private loadEquipments(): Equipment[] {
    if (typeof window === 'undefined') return [...this.defaultEquipments];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Equipment[];
        if (Array.isArray(parsed) && parsed.length > 0) return this.migrateLegacyIds(parsed);
      }
    } catch {
      /* données corrompues → valeurs par défaut */
    }
    return [...this.defaultEquipments];
  }

  /** Un ID au format court courant, ex. "SH-014". */
  private static readonly CLEAN_ID_RE = /^SH-(\d+)$/i;

  /**
   * Migration : tout équipement dont l'ID n'est pas déjà au format court
   * "SH-001" (IMEI par défaut, identifiant technique généré du type
   * "EQ-KIT-SOLAIRE-STR-HO-02-mu44vj13", ou ancien format sans tiret
   * "SH001") est glissé vers ce format, une seule fois, pour les parcs déjà
   * persistés.
   */
  private migrateLegacyIds(equipments: Equipment[]): Equipment[] {
    const migrated = [...equipments];
    let changed = false;
    for (let i = 0; i < migrated.length; i++) {
      if (EquipmentService.CLEAN_ID_RE.test(migrated[i].id)) continue;
      migrated[i] = { ...migrated[i], id: this.nextCleanId(migrated) };
      changed = true;
    }
    if (changed) {
      this.equipments = migrated;
      this.saveEquipments();
    }
    return migrated;
  }

  /** Prochain identifiant court disponible, format "SH-001" (jamais réutilisé). */
  private nextCleanId(pool: Equipment[] = this.equipments): string {
    const used = new Set(
      pool
        .map(e => EquipmentService.CLEAN_ID_RE.exec(e.id)?.[1])
        .filter((n): n is string => !!n)
        .map(Number)
    );
    let next = 1;
    while (used.has(next)) next++;
    return 'SH-' + next.toString().padStart(3, '0');
  }

  private saveEquipments(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.equipments));
    }
  }

  getAll(): Equipment[] {
    return this.equipments;
  }

  getById(id: string): Equipment | undefined {
    return this.equipments.find(e => e.id === id);
  }

  /** Prochain identifiant court disponible (format "SH-001"), pour pré-remplir/compléter un formulaire. */
  generateEquipmentId(): string {
    return this.nextCleanId();
  }

  /**
   * Retrouve l'équipement portant ce nom, ou en crée un minimal à la volée
   * (localement, sans appel backend) s'il n'existe pas encore.
   *
   * Certaines alertes/maintenances de démonstration (ex. celles amorcées
   * automatiquement pour une nouvelle structure) référencent un équipement
   * par son nom sans qu'il existe forcément dans le parc — sans ce filet,
   * cliquer sur la ligne ne menait nulle part (aucune correspondance trouvée).
   */
  getOrCreateByName(nom: string, hints?: Partial<Pick<Equipment, 'localisation' | 'lienLocalisation' | 'type'>>): Equipment {
    const existing = this.equipments.find(e => e.nom === nom);
    if (existing) return existing;

    const created: Equipment = {
      id: this.nextCleanId(),
      nom,
      statut: 'En ligne',
      localisation: hints?.localisation || '',
      lienLocalisation: hints?.lienLocalisation || '',
      miseEnLigne: new Date().toLocaleDateString('fr-FR'),
      type: hints?.type || 'Kit solaire',
      temperature: null,
      tension: null
    };
    this.equipments = [...this.equipments, created];
    this.saveEquipments();
    return created;
  }

  /**
   * Message d'erreur du dernier changement d'état (bloquer/débloquer).
   * Null si la dernière opération a réussi.
   */
  readonly equipmentStatusError = signal<string | null>(null);

  /**
   * Message d'erreur du dernier ajout d'équipement.
   * Null si le dernier ajout a réussi.
   */
  readonly equipmentCreateError = signal<string | null>(null);

  /**
   * Enregistre un nouvel équipement.
   *
   * Endpoint backend attendu — convention REST (cf. PATCH /api/equipements/{id}/status
   * et le contrat API) :
   *
   *   POST /api/equipements
   *   Body : l'objet équipement { id, nom, type, statut, localisation, lienLocalisation, miseEnLigne, ... }
   *   Rôle : ADMIN_STRUCTURE (équipements de sa structure) / SUPERADMIN
   *   Réponses : 201 (créé) / 409 (ID déjà existant)
   *
   * En mode développeur (EQUIPMENT_API_CONFIG.useMock), l'ajout est enregistré
   * localement pour pouvoir tester le parc sans backend.
   *
   * En mode réel, l'équipement n'est ajouté à la liste locale QUE si le backend
   * confirme la création (aucun faux succès). Les erreurs sont exposées via
   * `equipmentCreateError`.
   */
  createEquipment(data: Equipment): Observable<Equipment | null> {
    if (EQUIPMENT_API_CONFIG.useMock) {
      this.equipmentCreateError.set(null);
      const created: Equipment = {
        ...data,
        temperature: null,
        tension: null,
        bloque: false
      };
      this.equipments.push(created);
      this.saveEquipments();
      return of(created);
    }

    this.equipmentCreateError.set(null);
    return this.http.post<Equipment>('/api/equipements', data).pipe(
      map(created => {
        this.equipments.push({
          ...created,
          temperature: created.temperature ?? null,
          tension: created.tension ?? null,
          bloque: created.bloque ?? false
        });
        this.saveEquipments();
        return created;
      }),
      catchError((error: HttpErrorResponse) => {
        this.equipmentCreateError.set(this.buildCreateErrorMessage(error));
        return of(null);
      })
    );
  }

  private buildCreateErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "Backend indisponible : impossible d'enregistrer l'équipement.";
    }
    if (error.status === 409) {
      return 'Un équipement avec cet ID existe déjà.';
    }
    if (error.status === 401 || error.status === 403) {
      return "Vous n'avez pas les droits nécessaires pour ajouter un équipement.";
    }
    if (error.status === 404) {
      return "Endpoint d'ajout non disponible côté backend (POST /api/equipements).";
    }
    return `Erreur ${error.status} lors de l'ajout de l'équipement.`;
  }

  /**
   * Bloque ou débloque un équipement.
   *
   * Endpoint backend attendu — convention projet (cf. BACKEND_API_CONTRACT.md :
   * PATCH /api/users/:id/status et PATCH /api/structures/:id/status) :
   *
   *   PATCH /api/equipements/{id}/status
   *   Body : { "statut": "BLOQUE" | "ACTIF" }
   *   Rôle : ADMIN_STRUCTURE (équipements de sa structure) / SUPERADMIN
   *
   * Tant que l'endpoint n'existe pas côté backend, l'appel échoue et
   * `equipmentStatusError` expose un message clair ; l'état local n'est
   * PAS modifié (aucun faux succès).
   */
  setEquipmentStatus(id: string, bloque: boolean): Observable<Equipment | null> {
    this.equipmentStatusError.set(null);

    if (EQUIPMENT_API_CONFIG.useMock) {
      this.applyLocalStatus(id, bloque);
      return of(this.getById(id) ?? null);
    }

    const body = { statut: bloque ? 'BLOQUE' : 'ACTIF' };
    return this.http
      .patch<Equipment>(`/api/equipements/${encodeURIComponent(id)}/status`, body)
      .pipe(
        map(() => {
          this.applyLocalStatus(id, bloque);
          return this.getById(id) ?? null;
        }),
        catchError((error: HttpErrorResponse) => {
          this.equipmentStatusError.set(this.buildStatusErrorMessage(error));
          return of(null);
        })
      );
  }

  /** Met à jour l'état local (source actuelle du parc) sans recharger la page. */
  private applyLocalStatus(id: string, bloque: boolean): void {
    const equipment = this.equipments.find(e => e.id === id);
    if (equipment) {
      equipment.bloque = bloque;
      this.saveEquipments();
    }
  }

  private buildStatusErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "Backend indisponible : impossible de changer l'état de l'équipement.";
    }
    if (error.status === 404) {
      return 'Endpoint de blocage non disponible côté backend (PATCH /api/equipements/{id}/status).';
    }
    if (error.status === 401 || error.status === 403) {
      return "Vous n'avez pas les droits nécessaires pour bloquer/débloquer cet équipement.";
    }
    return `Erreur ${error.status} lors du changement d'état de l'équipement.`;
  }

  /**
   * Diagnostic dérivé du statut réel de l'équipement (aucune donnée inventée).
   */
  getDiagnostic(equipment: Equipment): EquipmentDiagnostic {
    if (equipment.statut.includes('En alerte')) {
      return { etat: 'Anomalie détectée', gravite: 'Élevée', anomalie: 'Alerte active sur cet équipement' };
    }
    if (equipment.statut.includes('Inspection')) {
      return { etat: 'Inspection requise', gravite: 'Moyenne', anomalie: 'Contrôle à planifier' };
    }
    return { etat: 'État normal', gravite: '—', anomalie: null };
  }

  /**
   * Diagnostic batterie courant — GET /api/batterie/{device_id}/actuel.
   *
   * Renvoie null si aucune donnée (404 / données absentes) ou en cas d'erreur
   * API / backend indisponible (le détail est alors exposé via `batteryApiError`).
   */
  getBatteryCurrentDiagnostic(deviceId: string): Observable<BatteryCurrentDiagnostic | null> {
    if (EQUIPMENT_API_CONFIG.useMock) {
      return of(mockBatteryCurrentDiagnostic(deviceId));
    }
    this.batteryApiError.set(null);
    return this.http
      .get<BatteryCurrentDiagnostic>(`${EQUIPMENT_API_CONFIG.batteryBaseUrl}/${encodeURIComponent(deviceId)}/actuel`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.handleBatteryError(error);
          return of(null);
        })
      );
  }

  /**
   * Historique batterie — GET /api/batterie/{device_id}/historique.
   *
   * Renvoie [] si aucune donnée (404) ou en cas d'erreur API / backend
   * indisponible (le détail est alors exposé via `batteryApiError`).
   */
  getBatteryHistory(deviceId: string): Observable<BatteryHistoryEntry[]> {
    if (EQUIPMENT_API_CONFIG.useMock) {
      return of(mockBatteryHistory(deviceId));
    }
    this.batteryApiError.set(null);
    return this.http
      .get<BatteryHistoryEntry[]>(`${EQUIPMENT_API_CONFIG.batteryBaseUrl}/${encodeURIComponent(deviceId)}/historique`)
      .pipe(
        map(list => (Array.isArray(list) ? list : [])),
        catchError((error: HttpErrorResponse) => {
          this.handleBatteryError(error);
          return of([]);
        })
      );
  }

  /**
   * Historique de localisation — GET /api/equipements/{id}/localisations.
   *
   * Endpoint attendu côté backend (convention projet, cf. blocage équipement) :
   * renvoie [] si aucune donnée (404 / endpoint absent) ; les erreurs réelles
   * (backend indisponible, HTTP != 404) sont exposées via `locationHistoryError`.
   */
  getEquipmentLocationHistory(id: string): Observable<LocationHistoryEntry[]> {
    this.locationHistoryError.set(null);

    if (EQUIPMENT_API_CONFIG.useMock) {
      const equipment = this.getById(id);
      return of(mockLocationHistory(id, equipment?.localisation ?? '', equipment?.lienLocalisation ?? ''));
    }

    return this.http
      .get<LocationHistoryEntry[]>(`/api/equipements/${encodeURIComponent(id)}/localisations`)
      .pipe(
        map(list => (Array.isArray(list) ? list : [])),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 0) {
            this.locationHistoryError.set(
              "Backend indisponible : impossible de récupérer l'historique de localisation."
            );
          } else if (error.status !== 404) {
            this.locationHistoryError.set(`Erreur API localisation (HTTP ${error.status}).`);
          }
          return of([]);
        })
      );
  }

  /** Traduit une erreur d'appel API batterie en message utilisable par les pages. */
  private handleBatteryError(error: HttpErrorResponse): void {
    // 404 = pas encore de données pour cet équipement : ce n'est pas une erreur bloquante.
    if (error.status === 404) {
      return;
    }
    if (error.status === 0) {
      this.batteryApiError.set(
        'Backend batterie indisponible. Vérifiez que le service de diagnostic est démarré, puis réessayez.'
      );
      return;
    }
    this.batteryApiError.set(`Erreur API batterie (HTTP ${error.status}).`);
  }
}