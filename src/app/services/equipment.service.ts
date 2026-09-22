import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { EQUIPMENT_API_CONFIG } from '../config/equipment-api.config';
import { mockBatteryCurrentDiagnostic, mockBatteryHistory, mockLocationHistory } from './equipment-mock-data';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../environments/environment';

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
  /** Marque / modèle du matériel (ex. « Alioth »). */
  marqueModele?: string;
  /** Nom du client auquel l'équipement est attribué. */
  clientNom?: string;
  /** Numéro / référence du client. */
  clientNumero?: string;
  /** Site / emplacement descriptif (distinct des coordonnées GPS). */
  site?: string;
  /** Identifiant du boîtier IoT SHANGO installé sur l'équipement. */
  boitierId?: string;
  /** Personne responsable de l'équipement côté structure. */
  responsable?: string;
  /** Photo de l'équipement, stockée en data URL (mode mock, sans backend de fichiers). */
  photoDataUrl?: string;
  /** Rayon autorisé (mètres) autour de la position d'installation avant alerte de déplacement. */
  perimetreMetres?: number;
  /**
   * Clé primaire backend (`equipements.id`), distincte de `id` (le code
   * métier "SH-014" utilisé côté frontend comme `reference`). Nécessaire
   * pour cibler `PUT/PATCH /api/equipements/{backendId}`. Absente pour un
   * équipement jamais synchronisé avec le backend.
   */
  backendId?: number;
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
  /** Humidité mesurée au niveau du boîtier/de la batterie (%). */
  humidite_pourcent: number | null;
  /** Statut de paiement de l'équipement (ex. « Payé », « Impayé », « En retard »), fourni par le backend. */
  statut_paiement: string | null;
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
 * Dernière télémétrie reçue d'un boîtier IoT SHANGO, fournie par le backend :
 *   GET /api/equipements/{id}/telemetries (le plus récent, trié par horodatage)
 *
 * Distinct du diagnostic batterie (IA, lancé manuellement) : la télémétrie
 * est envoyée en continu par le bridge IoT sans action de l'utilisateur.
 */
export interface TelemetrieEntry {
  tension: number | null;
  courant: number | null;
  temperature: number | null;
  humidite: number | null;
  etat_kit: string | null;
  statut_paiement: string | null;
  signal_gsm: number | null;
  /** Position GPS envoyée par le boîtier avec cette télémétrie (peut être absente tant qu'aucun fix satellite n'a été obtenu). */
  latitude: number | null;
  longitude: number | null;
  horodatage: string;
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

  private authService = inject(AuthService);

  constructor(private http: HttpClient) {}

  private readonly STORAGE_KEY = 'shango_equipments';

  /**
   * Parc vide par défaut : la vraie liste vient désormais du backend
   * (`load()` → GET /api/equipements). Ce tableau ne sert plus que de filet
   * de sécurité (SSR, backend injoignable au tout premier chargement).
   */
  private readonly defaultEquipments: Equipment[] = [];

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.migrateLegacyIds(parsed).map(e => this.ensureDisplayName(e));
        }
      }
    } catch {
      /* données corrompues → valeurs par défaut */
    }
    return [...this.defaultEquipments];
  }

  /**
   * Garantit qu'un équipement a toujours un `nom` d'affichage non vide.
   *
   * `nom` n'est pas encore persisté côté backend (voir
   * SHANGO/FRONTEND_INTEGRATION_GAPS.md §1) : un équipement créé sur un autre
   * poste, ou rechargé un jour depuis une future liste backend, pourrait
   * arriver sans `nom`. Sans ce filet, la colonne « Équipement » du tableau
   * du parc — et le rapprochement par nom utilisé par les pages
   * Alertes/Maintenance — se retrouveraient vides plutôt que de recourir à
   * une identification fiable (`type` + `reference`, toujours fournis par
   * le backend).
   */
  private ensureDisplayName(e: Equipment): Equipment {
    if (e.nom && e.nom.trim()) return e;
    return { ...e, nom: `${e.type} ${e.id}` };
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

  /** Message d'erreur du dernier chargement de la liste (null si succès ou pas encore appelé). */
  readonly loadError = signal<string | null>(null);
  readonly loading = signal(false);

  /**
   * Charge la liste réelle des équipements — GET /api/equipements.
   *
   * Remplace le cache local par la liste backend en cas de succès (partagée
   * entre tous les postes désormais, puisque la création persiste pour de
   * vrai). En cas d'échec (backend indisponible...), le cache local existant
   * est conservé tel quel — `loadError` expose le message.
   *
   * Les champs non encore persistés côté backend (nom, description, infos
   * client, marque, site, photo, périmètre — voir
   * SHANGO/FRONTEND_INTEGRATION_GAPS.md §1) sont récupérés depuis le cache
   * local existant quand l'équipement y est déjà connu (créé depuis ce
   * poste), sinon ils restent vides et `ensureDisplayName` prend le relais
   * pour l'affichage.
   */
  load(): Observable<Equipment[]> {
    this.loading.set(true);
    this.loadError.set(null);
    return this.http.get<{ data: any[] }>(`${environment.apiUrl}/equipements`).pipe(
      map(res => res.data.map((raw: any) => this.mapBackendEquipment(raw))),
      map(list => {
        this.equipments = list;
        this.saveEquipments();
        this.loading.set(false);
        return list;
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          error.status === 0
            ? 'Backend indisponible : impossible de charger le parc réel (liste locale affichée).'
            : `Erreur ${error.status} lors du chargement du parc.`
        );
        return of(this.equipments);
      })
    );
  }

  /** Traduit le statut backend (`Equipement.status`) vers le libellé humain utilisé côté UI. */
  private mapBackendEquipmentStatus(status: string, etatKit: string | null | undefined): string {
    if (etatKit === 'BLOQUE') return 'Bloqué';
    switch (status) {
      case 'en_panne': return 'En alerte';
      case 'maintenance': return 'Inspection';
      case 'hors_service': return 'Hors service';
      default: return 'En ligne';
    }
  }

  private mapBackendEquipment(raw: any): Equipment {
    const existing = this.equipments.find(e => e.id === raw.reference);
    const miseEnLigne = existing?.miseEnLigne
      || (raw.created_at
        ? new Date(raw.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '');

    return this.ensureDisplayName({
      id: raw.reference,
      backendId: raw.id,
      nom: raw.nom || existing?.nom || '',
      statut: this.mapBackendEquipmentStatus(raw.status, raw.etat_kit),
      localisation: existing?.localisation || 'En attente du GPS (IoT)',
      lienLocalisation: existing?.lienLocalisation || '',
      miseEnLigne,
      type: raw.type,
      description: raw.description ?? existing?.description,
      temperature: null,
      tension: null,
      bloque: raw.etat_kit === 'BLOQUE',
      marqueModele: raw.marque_modele ?? existing?.marqueModele,
      clientNom: raw.client_nom ?? existing?.clientNom,
      clientNumero: raw.client_numero ?? existing?.clientNumero,
      site: raw.site ?? existing?.site,
      boitierId: raw.device_id,
      responsable: existing?.responsable,
      photoDataUrl: this.buildPhotoUrl(raw.photo) ?? existing?.photoDataUrl,
      perimetreMetres: raw.perimetre_metres != null ? Number(raw.perimetre_metres) : existing?.perimetreMetres
    });
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

  /** Prochain identifiant de boîtier IoT SHANGO disponible, format "SH-001" (jamais réutilisé). */
  generateBoitierId(): string {
    const used = new Set(
      this.equipments
        .map(e => /^SH-(\d+)$/i.exec(e.boitierId ?? '')?.[1])
        .filter((n): n is string => !!n)
        .map(Number)
    );
    let next = 1;
    while (used.has(next)) next++;
    return 'SH-' + next.toString().padStart(3, '0');
  }

  /**
   * Prochain numéro d'affichage disponible pour le parc, format "#SK-20"
   * (jamais réutilisé, incrémental sur l'ensemble du parc). Utilisé dans le
   * nom de l'équipement (ex. "Kit solaire #SK-20"), distinct de son ID
   * métier (SH-xxx) et de l'ID du boîtier.
   */
  generateDisplayNumber(): number {
    const used = this.equipments
      .map(e => /#SK-(\d+)/i.exec(e.nom)?.[1])
      .filter((n): n is string => !!n)
      .map(Number);
    return used.length > 0 ? Math.max(...used) + 1 : 1;
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
   * Enregistre un nouvel équipement — POST /api/equipements (backend réel,
   * indépendant de EQUIPMENT_API_CONFIG.useMock : la création est branchée
   * en dur sur l'API depuis l'intégration du 2026-09-17).
   *
   * Mapping vers le schéma backend (`Equipement`) :
   *   - organization_id : structure de l'utilisateur connecté (le backend
   *     l'exige actuellement au lieu de le déduire lui-même du token — voir
   *     SHANGO/FRONTEND_INTEGRATION_GAPS.md §1).
   *   - reference : `data.id` (code métier généré, ex. "SH-014").
   *   - device_id : `data.boitierId` (ID du boîtier SHANGO — confirmé être le
   *     vrai identifiant que le boîtier physique utilisera pour ses envois).
   *   - status : "actif" par défaut ; l'état réel viendra de la télémétrie IoT.
   *
   * Depuis l'ajout de la migration `add_frontend_fields_to_equipements_table`
   * (2026-09-17), `nom`/`description`/`client_nom`/`client_numero`/
   * `marque_modele`/`site`/`perimetre_metres` sont aussi envoyés et
   * persistent réellement.
   *
   * Photo (2026-09-17, suite) : le backend valide maintenant `photo` comme
   * une vraie image uploadée (`image|mimes:jpg,jpeg,png,webp|max:5120`,
   * stockée via `Storage::disk('public')`) — plus une simple chaîne. Quand
   * un fichier est fourni, la requête part en `multipart/form-data`
   * (FormData) au lieu de JSON ; sinon elle reste en JSON comme avant.
   */
  createEquipment(data: Equipment, photoFile?: File | null): Observable<Equipment | null> {
    this.equipmentCreateError.set(null);

    const organizationId = this.authService.structureId;
    if (!organizationId) {
      this.equipmentCreateError.set('Impossible de déterminer votre structure. Reconnectez-vous et réessayez.');
      return of(null);
    }

    const fields: Record<string, string | number | undefined> = {
      organization_id: Number(organizationId),
      type: data.type,
      reference: data.id,
      device_id: data.boitierId,
      status: 'actif',
      nom: data.nom || undefined,
      description: data.description || undefined,
      client_nom: data.clientNom || undefined,
      client_numero: data.clientNumero || undefined,
      marque_modele: data.marqueModele || undefined,
      site: data.site || undefined,
      perimetre_metres: data.perimetreMetres ?? undefined
    };

    let body: FormData | Record<string, string | number | undefined>;
    if (photoFile) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) formData.append(key, String(value));
      }
      formData.append('photo', photoFile, photoFile.name);
      body = formData;
    } else {
      body = fields;
    }

    return this.http.post<{ data: any }>(`${environment.apiUrl}/equipements`, body).pipe(
      map(res => {
        const backendEquipement = res.data;
        const created = this.ensureDisplayName({
          ...data,
          id: backendEquipement.reference,
          backendId: backendEquipement.id,
          boitierId: backendEquipement.device_id,
          bloque: backendEquipement.etat_kit === 'BLOQUE',
          nom: backendEquipement.nom || data.nom,
          description: backendEquipement.description ?? data.description,
          clientNom: backendEquipement.client_nom ?? data.clientNom,
          clientNumero: backendEquipement.client_numero ?? data.clientNumero,
          marqueModele: backendEquipement.marque_modele ?? data.marqueModele,
          site: backendEquipement.site ?? data.site,
          perimetreMetres: backendEquipement.perimetre_metres != null ? Number(backendEquipement.perimetre_metres) : data.perimetreMetres,
          photoDataUrl: this.buildPhotoUrl(backendEquipement.photo) ?? data.photoDataUrl,
          temperature: null,
          tension: null
        });
        this.equipments.push(created);
        this.saveEquipments();
        return created;
      }),
      catchError((error: HttpErrorResponse) => {
        this.equipmentCreateError.set(this.buildCreateErrorMessage(error));
        return of(null);
      })
    );
  }

  /**
   * Construit l'URL publique d'une photo stockée côté backend (disque
   * `public`, servi via le lien symbolique `public/storage`) à partir du
   * chemin relatif renvoyé par l'API (ex. "equipements/abc123.jpg").
   */
  private buildPhotoUrl(relativePath: string | null | undefined): string | undefined {
    if (!relativePath) return undefined;
    // apiUrl vaut '/api' en dev (proxy) ou une URL absolue en prod ('https://.../api').
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}/storage/${relativePath}`;
  }

  private buildCreateErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "Backend indisponible : impossible d'enregistrer l'équipement.";
    }
    if (error.status === 409 || error.status === 422) {
      const errors = error.error?.errors as Record<string, string[]> | undefined;
      const firstFieldError = errors ? Object.values(errors)[0]?.[0] : undefined;
      return firstFieldError || 'Un équipement avec cet ID (référence ou boîtier) existe déjà.';
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
   * Deux étapes distinctes, dans cet ordre :
   * 1. POST /api/commande — la vraie commande, relayée par le backend au
   *    Bridge IoT puis au boîtier en MQTT (shango/<device_id>/command).
   *    C'est la seule chose qui a un effet physique.
   * 2. Seulement si (1) réussit : PUT /api/equipements/{backendId} avec
   *    `{ "etat_kit": ... }`, pour refléter l'état dans l'app sans attendre
   *    la prochaine télémétrie du boîtier.
   *
   * Avant ce correctif (2026-09-22), seule l'étape 2 existait : l'app
   * affichait "Bloqué" sans qu'aucune commande n'ait jamais été envoyée au
   * boîtier — champ etat_kit en base, mais boîtier physique inchangé.
   *
   * Important : même après cette commande, `etat_kit` en base reste une
   * valeur optimiste tant que le boîtier n'a pas lui-même confirmé son
   * nouvel état via sa prochaine télémétrie/status (POST /api/status côté
   * boîtier) — c'est la seule source de vérité physique.
   */
  setEquipmentStatus(id: string, bloque: boolean): Observable<Equipment | null> {
    this.equipmentStatusError.set(null);

    const equipment = this.getById(id);
    if (!equipment?.backendId) {
      this.equipmentStatusError.set(
        "Cet équipement n'a pas encore été synchronisé avec le backend : rechargez la page (parc réel) avant de réessayer."
      );
      return of(null);
    }

    if (!equipment.boitierId) {
      this.equipmentStatusError.set(
        "Cet équipement n'a pas d'identifiant de boîtier (device_id) : impossible de lui envoyer une commande."
      );
      return of(null);
    }

    const commandeBody = {
      id_appareil: equipment.boitierId,
      commande: bloque ? 'BLOQUER' : 'DEBLOQUER',
      emis_par: this.authService.getUser()?.email ?? 'application',
    };

    return this.http.post<{ success: boolean; message?: string }>(`${environment.apiUrl}/commande`, commandeBody).pipe(
      switchMap(() => {
        const body = { etat_kit: bloque ? 'BLOQUE' : 'MARCHE' };
        return this.http.put<{ data: any }>(`${environment.apiUrl}/equipements/${equipment.backendId}`, body).pipe(
          map(() => {
            this.applyLocalStatus(id, bloque);
            return this.getById(id) ?? null;
          })
        );
      }),
      catchError((error: HttpErrorResponse) => {
        this.equipmentStatusError.set(this.buildCommandeErrorMessage(error));
        return of(null);
      })
    );
  }

  private buildCommandeErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 502) {
      return 'Le boîtier ne peut pas être joint en ce moment (Bridge IoT injoignable) : la commande n\'a pas été transmise.';
    }
    if (error.status === 404) {
      return 'Équipement introuvable côté backend (rechargez la page).';
    }
    if (error.status === 401 || error.status === 403) {
      return "Vous n'avez pas les droits nécessaires pour bloquer/débloquer cet équipement.";
    }
    if (error.status === 0) {
      return "Backend indisponible : impossible d'envoyer la commande au boîtier.";
    }
    return `Erreur ${error.status} lors de l'envoi de la commande au boîtier.`;
  }

  /** Met à jour l'état local (source actuelle du parc) sans recharger la page. */
  private applyLocalStatus(id: string, bloque: boolean): void {
    const equipment = this.equipments.find(e => e.id === id);
    if (equipment) {
      equipment.bloque = bloque;
      this.saveEquipments();
    }
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
   * Récupère l'historique brut (non mappé) depuis le seul endpoint batterie
   * qui existe réellement côté backend — GET /api/batteries/{device_id}/diagnostics
   * (trié du plus récent au plus ancien). `getBatteryCurrentDiagnostic` et
   * `getBatteryHistory` partagent cette même source : il n'y a pas
   * d'endpoint dédié "diagnostic actuel" côté backend (voir
   * SHANGO/FRONTEND_INTEGRATION_GAPS.md §2), donc le "diagnostic actuel" est
   * simplement le premier élément de cet historique.
   */
  private fetchBatteryHistoryRaw(deviceId: string): Observable<any[]> {
    this.batteryApiError.set(null);
    return this.http
      .get<{ historique: any[] }>(`${environment.apiUrl}/batteries/${encodeURIComponent(deviceId)}/diagnostics`)
      .pipe(
        map(res => (Array.isArray(res.historique) ? res.historique : [])),
        catchError((error: HttpErrorResponse) => {
          this.handleBatteryError(error);
          return of<any[]>([]);
        })
      );
  }

  /**
   * Diagnostic batterie courant, dérivé du dernier point de l'historique réel
   * (voir `fetchBatteryHistoryRaw`). `humidite_pourcent`, `statut_paiement`
   * et `message` restent `null` : pas encore fournis par le backend
   * (§2 du rapport d'écarts).
   */
  getBatteryCurrentDiagnostic(deviceId: string): Observable<BatteryCurrentDiagnostic | null> {
    if (EQUIPMENT_API_CONFIG.useMock) {
      return of(mockBatteryCurrentDiagnostic(deviceId));
    }
    return this.fetchBatteryHistoryRaw(deviceId).pipe(
      map((list): BatteryCurrentDiagnostic | null => {
        const latest = list[0];
        if (!latest) return null;
        return {
          device_id: latest.device_id,
          date_heure: latest.date_heure,
          voltage_v: latest.voltage_v ?? null,
          current_a: latest.current_a ?? null,
          temperature_c: latest.temperature_c ?? null,
          dod_percent: latest.dod_percent ?? null,
          humidite_pourcent: null,
          statut_paiement: null,
          soh_pourcent: latest.soh_pourcent ?? null,
          capacite_restante_ah: latest.capacite_ah ?? null,
          duree_estimee_jours: latest.rul_jours ?? null,
          etat: latest.etat ?? null,
          message: null
        };
      })
    );
  }

  /** Historique batterie — dérivé de `fetchBatteryHistoryRaw` (voir ce commentaire). */
  getBatteryHistory(deviceId: string): Observable<BatteryHistoryEntry[]> {
    if (EQUIPMENT_API_CONFIG.useMock) {
      return of(mockBatteryHistory(deviceId));
    }
    return this.fetchBatteryHistoryRaw(deviceId).pipe(
      map(list => list.map(raw => ({
        date_heure: raw.date_heure,
        soh: raw.soh_pourcent ?? null,
        capacite: raw.capacite_ah ?? null,
        rul_jours: raw.rul_jours ?? null,
        temperature: raw.temperature_c ?? null
      })))
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

  /**
   * Dernière télémétrie reçue pour cet équipement — GET /api/equipements/{backendId}/telemetries.
   * `backendId` est la clé primaire backend (`equipements.id`), pas la référence "SH-xxx".
   * Retourne `null` si aucune télémétrie n'a encore été reçue (404, liste vide, ou erreur).
   */
  getLatestTelemetrie(backendId: number): Observable<TelemetrieEntry | null> {
    return this.http
      .get<{ data: any[] }>(`${environment.apiUrl}/equipements/${backendId}/telemetries`)
      .pipe(
        map(res => {
          const latest = Array.isArray(res.data) ? res.data[0] : undefined;
          if (!latest) return null;
          return {
            tension: latest.tension != null ? Number(latest.tension) : null,
            courant: latest.courant != null ? Number(latest.courant) : null,
            temperature: latest.temperature != null ? Number(latest.temperature) : null,
            humidite: latest.humidite != null ? Number(latest.humidite) : null,
            etat_kit: latest.etat_kit ?? null,
            statut_paiement: latest.statut_paiement ?? null,
            signal_gsm: latest.signal_gsm != null ? Number(latest.signal_gsm) : null,
            latitude: latest.latitude != null ? Number(latest.latitude) : null,
            longitude: latest.longitude != null ? Number(latest.longitude) : null,
            horodatage: latest.horodatage
          };
        }),
        catchError(() => of(null))
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