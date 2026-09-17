import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { SettingsService } from './settings.service';
import { AuthService } from '../auth/auth.service';

export interface MaintenanceItem {
  id: string;
  /** Numéro d'affichage stable de l'intervention (ex. "N°003"), attribué à la création. */
  numero: number;
  equipment: string;
  type: string;
  /** Structure propriétaire de l'intervention (filtrage multi-structures). */
  structureId?: string;
  /** Sévérité de l'alerte d'origine — absente pour une maintenance planifiée directement. */
  severite?: 'Critique' | 'Avertissement';
  datePrevue: string;
  /** Date strictement comparable (ISO yyyy-MM-dd) pour la logique de rappel. */
  datePrevueISO?: string;
  technicien: string;
  statut: 'Planifiée' | 'En attente' | 'En cours' | 'Terminée';
  alertes: number;
  prisPar?: string;
  datePrise?: string;
  /** Techniciens affectés à l'intervention par l'admin (plateforme entière). */
  affectes?: { id: number; nom: string }[];
  /** Date à laquelle l'admin a affecté l'intervention aux techniciens. */
  dateAffectation?: string;
  /** Délai imparti pour l'intervention (saisi par l'admin, ex. « 48 h »). */
  delaiAffectation?: string;
  /** Nature(s) de l'intervention planifiée (multi-nature). */
  natures?: string[];
  /** Description libre (optionnelle) saisie par l'admin, transmise aux techniciens affectés. */
  description?: string;
  localisation?: string;
  lienLocalisation?: string;
  rapport?: RapportIntervention;
}

export interface NotificationItem {
  id: string;
  itemId: string;
  equipment: string;
  type: string;
  technicien: string;
  message: string;
  date: string;
  read: boolean;
  /** Technicien destinataire (nom). Absent → notification globale visible par tout le monde. */
  destinataire?: string;
  /** Page cible lorsqu'on clique sur la notification (redirection). */
  cible?: 'alerts' | 'maintenance' | 'rapports';
}

export interface RapportIntervention {
  contenu: string;
  dateRedaction: string;
  redacteur: string;
  piecesRemplacees?: string;
  dureeIntervention?: string;
  /** Type de rapport : intervention (par défaut) ou conformité */
  typeRapport?: 'intervention' | 'conformite';
  /** Conformité : l'inspection a-t-elle été réalisée ? */
  inspectionRealisee?: 'oui' | 'non';
  /** Conformité : l'équipement est-il conforme ? */
  equipementConforme?: 'oui' | 'non' | 'na';
  /** Conformité : commentaire libre d'inspection */
  commentaireInspection?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private readonly STORAGE_KEY = 'shango_maintenance_v8';
  private readonly NOTIFICATIONS_STORAGE_KEY = 'shango_notifications_v1';

  // Champ injecté (pas un paramètre de constructeur) : les initialiseurs de
  // champ de classe s'exécutent AVANT l'assignation des paramètres du
  // constructeur (même les "parameter properties" de TypeScript) — comme
  // `maintenanceItems` ci-dessous appelle `loadInitialData()` qui utilise
  // `authService` dès l'initialisation du champ, il doit être disponible
  // avant, donc déclaré ici et non en paramètre de constructeur.
  private authService = inject(AuthService);

  readonly maintenanceItems = signal<MaintenanceItem[]>(this.loadInitialData());
  /**
   * Notifications persistées (localStorage) afin qu'un technicien affecté à une
   * alerte par l'admin voie bien sa notification même après une déconnexion/
   * reconnexion ou un rafraîchissement de page (auparavant perdues car
   * uniquement conservées en mémoire).
   */
  readonly notifications = signal<NotificationItem[]>(this.loadNotifications());

  constructor(private settingsService: SettingsService) {
    // Synchronisation multi-onglets : si un autre onglet (autre technicien)
    // prend une alerte, cet onglet se met à jour immédiatement afin d'éviter
    // que deux techniciens se dirigent vers le même équipement en même temps.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', event => {
        if (event.key === this.STORAGE_KEY && event.newValue) {
          try {
            this.maintenanceItems.set(JSON.parse(event.newValue));
          } catch {
            /* données invalides : on ignore */
          }
        }
        if (event.key === this.NOTIFICATIONS_STORAGE_KEY && event.newValue) {
          try {
            this.notifications.set(JSON.parse(event.newValue));
          } catch {
            /* données invalides : on ignore */
          }
        }
      });
    }
    // Persistance automatique : toute mise à jour du signal (quel que soit
    // l'appelant) est immédiatement sauvegardée dans localStorage.
    effect(() => this.saveNotifications(this.notifications()));
    // Notifications automatiques : signaler aux techniciens affectés les
    // interventions planifiées dont la date approche (réglé dans /parametres).
    this.verifierProchainesInterventions();

    // Resynchronisation à chaque connexion : ce service est injecté dans
    // app.ts (racine), donc construit AVANT toute connexion (dès la page de
    // login) — le structureId de l'utilisateur n'est alors pas encore
    // connu. On réagit ici à chaque passage à "connecté" (connexion initiale
    // OU changement de compte de test dans le même navigateur) pour
    // réattacher les données de démo à la bonne structure.
    effect(() => {
      if (!this.authService.isLoggedIn()) return;
      untracked(() => {
        const current = this.maintenanceItems();
        const resynced = this.resyncStructureId(current);
        if (resynced !== current) {
          this.maintenanceItems.set(resynced);
        }
      });
    }, { allowSignalWrites: true });
  }

  private loadNotifications(): NotificationItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.NOTIFICATIONS_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as NotificationItem[];
        if (Array.isArray(stored)) return stored;
      }
    } catch {
      /* données corrompues : on repart d'une liste vide */
    }
    return [];
  }

  private saveNotifications(notifs: NotificationItem[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
    }
  }

  /**
   * Réattribue les items de démo déjà en cache à la structure de
   * l'utilisateur ACTUELLEMENT connecté si aucun d'eux ne lui appartient déjà.
   *
   * Le seed initial fige un structureId au premier chargement (voir plus
   * bas) ; mais en cours de développement/tests, un même navigateur teste
   * souvent plusieurs comptes admin (donc plusieurs structureId) — sans ce
   * filet, les données de démo restent figées sur le TOUT premier compte
   * utilisé et deviennent invisibles (page vide) pour tout autre compte,
   * alors qu'on veut toujours au moins un élément visible pour tester.
   */
  private resyncStructureId(items: MaintenanceItem[]): MaintenanceItem[] {
    const currentId = this.authService.getUser()?.structureId;
    if (!currentId) return items;
    if (items.some(i => i.structureId === currentId)) return items;
    const resynced = items.map(i => ({ ...i, structureId: currentId }));
    this.save(resynced);
    return resynced;
  }

  private loadInitialData(): MaintenanceItem[] {
    // Nettoyage des anciennes clés de stockage (migration v1 -> ... -> v7 -> v8).
    // v8 : les items de démo v7 portaient un structureId fictif ("STR-001")
    // qui ne correspond plus à rien depuis le passage au vrai backend (les
    // structureId réels sont des ID d'organisation numériques, ex. "3") —
    // les pages Alertes/Maintenance (filtrées par structureId) restaient
    // vides pour tout le monde à cause de ce décalage.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shango_maintenance');
      localStorage.removeItem('shango_maintenance_v2');
      localStorage.removeItem('shango_maintenance_v3');
      localStorage.removeItem('shango_maintenance_v4');
      localStorage.removeItem('shango_maintenance_v5');
      localStorage.removeItem('shango_maintenance_v6');
      localStorage.removeItem('shango_maintenance_v7');
    }
    // Charger les données persistées : les prises d'alerte doivent survivre
    // à un rafraîchissement pour que tous les techniciens voient qui a pris quoi.
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as MaintenanceItem[];
          if (Array.isArray(stored) && stored.length > 0) {
            return this.resyncStructureId(stored);
          }
        } catch {
          /* données corrompues : on retombe sur les données de démonstration */
        }
      }
    }
    // Aucune donnée de démo : Maintenance/Alertes/Rapports n'ont pas encore
    // de vrai backend (voir SHANGO/FRONTEND_INTEGRATION_GAPS.md §4-5) ; les
    // pages restent vides tant que ce n'est pas branché, plutôt que
    // d'afficher de faux équipements/clients dans une démo publique.
    return [];
  }

  /** Prochain numéro d'affichage disponible (monotone, jamais réutilisé). */
  private nextNumero(): number {
    return Math.max(0, ...this.maintenanceItems().map(i => i.numero ?? 0)) + 1;
  }

  /**
   * Amorce 2 alertes de démonstration (1 Critique + 1 Avertissement) pour une
   * structure qui vient d'être créée, afin qu'un admin nouvellement inscrit
   * puisse immédiatement tester l'affectation / la planification d'intervention
   * sans partir d'une page Alertes vide. N'ajoute rien si la structure possède
   * déjà des interventions (évite les doublons si appelé plusieurs fois).
   */
  seedAlertsForStructure(structureId: string, structureLabel?: string): void {
    if (this.maintenanceItems().some(i => i.structureId === structureId)) return;

    const label = (structureLabel || structureId).replace(/\s+/g, '').slice(0, 6).toUpperCase();
    const base = this.nextNumero();
    const uid = () => 'm' + Date.now() + Math.random().toString(36).slice(2, 7);

    const equip1Nom = `Kit solaire #${label}-01`;
    const equip2Nom = `Kit solaire #${label}-02`;

    const nouvellesAlertes: MaintenanceItem[] = [
      {
        id: uid(), numero: base, equipment: equip1Nom, type: 'Tension anormale',
        severite: 'Critique', structureId, datePrevue: '10 septembre 2026', technicien: '', statut: 'En attente', alertes: 1,
        localisation: '12.3714°N, -1.5197°E', lienLocalisation: '12.3714,-1.5197'
      },
      {
        id: uid(), numero: base + 1, equipment: equip2Nom, type: 'Niveau batterie faible',
        severite: 'Avertissement', structureId, datePrevue: '10 septembre 2026', technicien: '', statut: 'En attente', alertes: 1,
        localisation: '11.1784°N, -4.2979°E', lienLocalisation: '11.1784,-4.2979'
      }
    ];

    const items = [...this.maintenanceItems(), ...nouvellesAlertes];
    this.maintenanceItems.set(items);
    this.save(items);
  }

  private save(items: MaintenanceItem[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    }
  }

  getItems(): MaintenanceItem[] {
    return this.maintenanceItems();
  }

  /** Planifier une nouvelle maintenance (admin uniquement) */
  planifierMaintenance(item: Omit<MaintenanceItem, 'id' | 'numero'>): void {
    const newItem: MaintenanceItem = {
      ...item,
      id: 'm' + Date.now(),
      numero: this.nextNumero()
    };
    const items = [...this.maintenanceItems(), newItem];
    this.maintenanceItems.set(items);
    this.save(items);
  }

  /**
   * Prendre une alerte / un équipement en charge (technicien ou admin).
   * La prise en charge est IMMÉDIATE : aucune validation admin n'est requise.
   * Le nom du technicien et la date de prise sont enregistrés afin que les
   * autres techniciens voient immédiatement que l'alerte est déjà prise.
   *
   * @returns true si la prise en charge a réussi,
   *          false si l'alerte est déjà prise par quelqu'un d'autre.
   */
  prendreAlerte(id: string, userName: string): boolean {
    const target = this.maintenanceItems().find(i => i.id === id);

    // Garde anti-doublon : une seule personne peut prendre une même alerte
    if (!target || target.prisPar) {
      return false;
    }

    const datePrise = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const items = this.maintenanceItems().map(item =>
      item.id === id
        ? { ...item, prisPar: userName, datePrise, statut: 'En cours' as const }
        : item
    );
    this.maintenanceItems.set(items);
    this.save(items);

    // Créer une notification informant que l'alerte est prise en charge
    const notif: NotificationItem = {
      id: 'n' + Date.now(),
      itemId: id,
      equipment: target.equipment,
      type: target.type,
      technicien: userName,
      message: `${userName} a pris l'alerte "${target.type}" sur ${target.equipment}. Intervention en cours.`,
      date: datePrise,
      read: false
    };
    this.notifications.set([...this.notifications(), notif]);

    return true;
  }

  /**
   * Affecter une alerte à un ou plusieurs techniciens (plateforme entière).
   * Chaque technicien affecté reçoit une notification individuelle. L'alerte
   * est marquée comme prise en charge (alertes: 0) afin qu'elle disparaisse
   * de la file des alertes non traitées (/alerts) et bascule sur /maintenance
   * — sans quoi elle restait affichable et pouvait être affectée une 2e fois.
   * @param dateAffectation Date de l'affectation (saisie par l'admin, affichée au technicien).
   * @param delai Délai imparti pour l'intervention (saisi par l'admin).
   * @param description Description libre optionnelle, transmise aux techniciens affectés.
   */
  affecterAlerte(id: string, techniciens: { id: number; nom: string }[], dateAffectation?: string, delai?: string, description?: string): void {
    const now = this.maintenanceDate();
    const items = this.maintenanceItems().map(item =>
      item.id === id
        ? {
            ...item,
            affectes: techniciens,
            dateAffectation: dateAffectation || now,
            delaiAffectation: delai || undefined,
            description: description || undefined,
            alertes: 0
          }
        : item
    );
    this.maintenanceItems.set(items);
    this.save(items);

    const target = this.maintenanceItems().find(i => i.id === id);
    if (!target) return;
    const date = this.maintenanceDate();
    const dateSaisie = dateAffectation || date;
    techniciens.forEach(t => {
      this.pushNotification({
        itemId: id,
        equipment: target.equipment,
        type: target.type,
        technicien: t.nom,
        message: `Vous avez été affecté à l'alerte « ${target.type} » sur ${target.equipment} (affecté le ${dateSaisie}${delai ? `, délai ${delai}` : ''}).${description ? ` ${description}` : ''}`,
        date,
        destinataire: t.nom
      });
    });
  }

  /**
   * Planifier une intervention de maintenance depuis une alerte existante :
   * la date et la/les nature(s) sont définies, les techniciens affectés notifiés.
   */
  planifierIntervention(
    id: string,
    data: { nature: string; natures: string[]; date: string; techniciens: { id: number; nom: string }[]; description?: string }
  ): void {
    const dateAffect = this.maintenanceDate();
    const items = this.maintenanceItems().map(item =>
      item.id === id
        ? {
            ...item,
            type: data.nature,
            natures: data.natures,
            description: data.description || undefined,
            datePrevue: data.date,
            datePrevueISO: data.date,
            statut: 'Planifiée' as const,
            alertes: 0,
            prisPar: undefined,
            datePrise: undefined,
            affectes: data.techniciens,
            dateAffectation: dateAffect,
            delaiAffectation: undefined
          }
        : item
    );
    this.maintenanceItems.set(items);
    this.save(items);

    const target = items.find(i => i.id === id) ?? this.maintenanceItems().find(i => i.id === id);
    const date = this.maintenanceDate();
    data.techniciens.forEach(t => {
      this.pushNotification({
        itemId: id,
        equipment: (target as MaintenanceItem | undefined)?.equipment ?? '',
        type: data.nature,
        technicien: t.nom,
        message: `Vous avez été affecté à l'intervention « ${data.nature} » sur ${(target as MaintenanceItem | undefined)?.equipment ?? ''} prévue le ${data.date}.${data.description ? ` ${data.description}` : ''}`,
        date,
        destinataire: t.nom
      });
    });
  }

  /**
   * Planifier une nouvelle intervention de maintenance directement
   * (utilisée depuis la page Maintenance, si l'option est active).
   */
  planifierNouvelleIntervention(
    data: {
      equipment: string;
      nature: string;
      natures: string[];
      date: string;
      techniciens: { id: number; nom: string }[];
      dateAffectation?: string;
      delaiAffectation?: string;
    }
  ): void {
    const newItem: MaintenanceItem = {
      id: 'm' + Date.now(),
      numero: this.nextNumero(),
      equipment: data.equipment,
      type: data.nature,
      natures: data.natures,
      datePrevue: data.date,
      datePrevueISO: data.date,
      technicien: data.techniciens.map(t => t.nom).join(', '),
      statut: 'Planifiée',
      alertes: 0,
      affectes: data.techniciens,
      dateAffectation: data.dateAffectation || this.maintenanceDate(),
      delaiAffectation: data.delaiAffectation || undefined,
      localisation: '',
      lienLocalisation: ''
    };
    const items = [...this.maintenanceItems(), newItem];
    this.maintenanceItems.set(items);
    this.save(items);

    const date = this.maintenanceDate();
    data.techniciens.forEach(t => {
      this.pushNotification({
        itemId: newItem.id,
        equipment: data.equipment,
        type: data.nature,
        technicien: t.nom,
        message: `Vous avez été affecté à l'intervention « ${data.nature} » sur ${data.equipment} prévue le ${data.date}.`,
        date,
        destinataire: t.nom
      });
    });
  }

  /**
   * Génère automatiquement (au chargement) une notification de rappel pour
   * chaque intervention planifiée dont la date approche, à destination des
   * techniciens affectés. Le délai est paramétrable dans /parametres.
   */
  private verifierProchainesInterventions(): void {
    const jours = Math.max(0, this.settingsService.settings().rappelAvantIntervention);
    const limite = new Date();
    limite.setDate(limite.getDate() + jours);
    limite.setHours(23, 59, 59, 999);

    const now = new Date().getTime();
    this.maintenanceItems().forEach(item => {
      if (item.statut !== 'Planifiée' || !item.datePrevueISO) return;
      const datePrev = new Date(item.datePrevueISO);
      if (Number.isNaN(datePrev.getTime())) return;
      if (datePrev.getTime() < now || datePrev.getTime() > limite.getTime()) return;

      const dejaNotifie = this.notifications().some(n => n.itemId === item.id && n.message.includes('approche'));
      if (dejaNotifie) return;

      const dateStr = this.formatDatePrevue(item.datePrevue);
      (item.affectes ?? []).forEach(t => {
        this.pushNotification({
          itemId: item.id,
          equipment: item.equipment,
          type: item.type,
          technicien: t.nom,
          message: `L'intervention « ${item.type} » sur ${item.equipment} approche : prévue le ${dateStr}.`,
          date: this.maintenanceDate(),
          destinataire: t.nom
        });
      });
    });
  }

  /** Formate une date d'affichage (ISO → texte français ; sinon retourne la valeur brute). */
  formatDatePrevue(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    return value;
  }

  private pushNotification(n: Omit<NotificationItem, 'id' | 'read'>): void {
    // Détermination automatique de la page cible (cliquer sur la notification y redirige).
    const cible: NotificationItem['cible'] = (n.message.includes('intervention') || n.message.includes('approche'))
      ? 'maintenance'
      : n.message.includes('rapport')
        ? 'rapports'
        : 'alerts';
    const notif: NotificationItem = {
      ...n,
      cible,
      id: 'n' + Date.now() + Math.random().toString(36).slice(2, 7),
      read: false
    };
    this.notifications.set([...this.notifications(), notif]);
  }

  private maintenanceDate(): string {
    return new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Valider une alerte côté admin (depuis le panneau de notifications).
   * Accepte l'identifiant d'une notification ('n...') ou d'une maintenance ('m...').
   */
  validerAlerte(id: string): void {
    if (id.startsWith('n')) {
      // Validation depuis une notification : la marquer comme traitée
      this.notifications.set(
        this.notifications().map(n => (n.id === id ? { ...n, read: true } : n))
      );
      return;
    }
    // Validation directe d'un item : l'alerte est acquittée
    const items = this.maintenanceItems().map(item =>
      item.id === id ? { ...item, alertes: 0 } : item
    );
    this.maintenanceItems.set(items);
    this.save(items);
  }

  /** Marquer une maintenance comme terminée */
  terminerMaintenance(id: string): void {
    const items = this.maintenanceItems().map(item => {
      if (item.id === id) {
        return { ...item, statut: 'Terminée' as const };
      }
      return item;
    });
    this.maintenanceItems.set(items);
    this.save(items);
  }

  /** Ajouter un rapport d'intervention pour une maintenance */
  redigerRapport(id: string, rapport: RapportIntervention): void {
    const items = this.maintenanceItems().map(item => {
      if (item.id === id) {
        return {
          ...item,
          rapport: {
            ...rapport,
            dateRedaction: new Date().toLocaleDateString('fr-FR'),
            redacteur: rapport.redacteur || 'Technicien'
          }
        };
      }
      return item;
    });
    this.maintenanceItems.set(items);
    this.save(items);
  }

  /** Récupérer le rapport d'une intervention */
  getRapport(id: string): RapportIntervention | undefined {
    return this.maintenanceItems().find(i => i.id === id)?.rapport;
  }

  /** Réinitialiser les données mock */
  reset(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.maintenanceItems.set(this.loadInitialData());
  }
}
