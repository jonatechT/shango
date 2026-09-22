import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { EquipmentService, Equipment } from '../services/equipment.service';
import { environment } from '../../environments/environment';

/** Statistiques réelles du parc — GET /api/dashboard (DashboardController). */
interface DashboardStats {
  equipements_total: number;
  equipements_actifs: number;
  equipements_inactifs: number;
  equipements_en_marche: number;
  equipements_bloques: number;
  techniciens_total: number;
  techniciens_actifs: number;
  incidents_total: number;
  incidents_en_attente: number;
  incidents_en_cours: number;
  incidents_resolus: number;
  maintenances_total: number;
  maintenances_en_cours: number;
  maintenances_terminees: number;
  interventions_total: number;
  alertes_total: number;
  alertes_nouvelles: number;
  alertes_en_cours: number;
  alertes_resolues: number;
}

/** Alerte réelle — GET /api/alertes (même contrat que alerts-page). */
interface RealAlerte {
  id: number;
  device_id: string;
  type_alerte: string;
  gravite: 'FAIBLE' | 'MOYENNE' | 'ELEVEE';
  statut: string;
  valeur: number | null;
  horodatage: string;
  equipement?: { id?: number; nom?: string; reference?: string } | null;
}

/** Incident réel — GET /api/incidents. Sert de flux "activités récentes" : aucune donnée d'activité inventée. */
interface RealIncident {
  id: number;
  type: string;
  description: string;
  status: string;
  created_at: string;
  equipement?: { id?: number; nom?: string; reference?: string } | null;
}

const TYPE_ALERTE_LABELS: Record<string, string> = {
  CHOC: 'Choc',
  SURCHAUFFE: 'Surchauffe',
  TENSION_FAIBLE: 'Tension faible',
  MOUVEMENT: 'Mouvement',
  BOITIER_OUVERT: 'Boîtier ouvert'
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  resolu: 'Résolu'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {

  /** true tant que GET /api/dashboard n'a pas répondu (évite d'afficher des zéros trompeurs). */
  statsLoading = true;
  statsError: string | null = null;

  totalEquipements = 0;
  enLigne = 0;
  /** "Hors ligne" = bloqué (etat_kit=BLOQUE) — pas de notion distincte côté backend. */
  horsLigne = 0;
  /** Compté sur le parc réel chargé (statut='Inspection', voir loadEquipmentBreakdown) — pas fourni par /api/dashboard. */
  enMaintenance = 0;
  /** Aucune notion "d'anomalie" distincte côté backend : incidents_total sert de proxy honnête. */
  anomalieDetectee = 0;

  /** Répartition par type d'équipement (raw.type du backend) — calculée sur le parc réel, pas fournie par /api/dashboard. */
  categoryBreakdown: { label: string; count: number; percent: number }[] = [];

  /**
   * Alertes "actives" — même convention que alerts-page (session-fresh) :
   * seules les alertes arrivées APRÈS l'ouverture du dashboard comptent,
   * pas tout ce qui a le statut "nouvelle" en base indéfiniment. Sans ça,
   * une alerte jamais explicitement résolue resterait comptée pour
   * toujours, même si personne ne la regarde plus — pas ce que "alerte
   * active" doit vouloir dire ici. Si rien n'est arrivé depuis l'ouverture,
   * la carte affiche 0, pas un total historique.
   */
  alerteActive = 0;
  recentAlerts: { id: number; title: string; time: string; equipementId?: string }[] = [];
  alertsLoading = true;
  private baselineMaxAlertId: number | null = null;
  private static readonly ALERTES_POLL_MS = 10000;
  private alertesPollingSubscription: Subscription | null = null;

  /** "Activités récentes" = incidents réels — GET /api/incidents, 5 derniers. Aucun flux d'activité générique n'existe côté backend. */
  recentActivities: { id: number; title: string; time: string; status: string; statusClass: string; equipementId?: string }[] = [];
  activitiesLoading = true;

  constructor(
    private router: Router,
    private http: HttpClient,
    private equipmentService: EquipmentService
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadEquipmentBreakdown();
    this.loadRecentAlerts();
    this.loadRecentActivities();
  }

  ngOnDestroy(): void {
    this.alertesPollingSubscription?.unsubscribe();
  }

  /** Navigation vers la page détail d'un équipement */
  goToEquipment(id: string | undefined): void {
    if (id) {
      this.router.navigate(['/equipements', id]);
    }
  }

  /** Navigation depuis une carte KPI du tableau de bord */
  goToPage(route: string): void {
    this.router.navigate([route]);
  }

  private loadStats(): void {
    this.statsLoading = true;
    this.statsError = null;
    this.http.get<{ success: boolean; statistiques: DashboardStats }>(`${environment.apiUrl}/dashboard`).subscribe({
      next: res => {
        this.statsLoading = false;
        const s = res.statistiques;
        this.totalEquipements = s.equipements_total;
        this.enLigne = s.equipements_en_marche;
        this.horsLigne = s.equipements_bloques;
        this.anomalieDetectee = s.incidents_total;
      },
      error: () => {
        this.statsLoading = false;
        this.statsError = 'Statistiques indisponibles (backend injoignable).';
      }
    });
  }

  /**
   * Répartition par type et par statut du parc réel — calculée côté frontend
   * à partir de la liste réelle des équipements (/api/equipements), car
   * /api/dashboard ne fournit ni répartition par type ni décompte
   * "en maintenance" isolé. Aucune valeur n'est inventée : un parc vide
   * donne une répartition vide, pas des pourcentages fictifs.
   */
  private loadEquipmentBreakdown(): void {
    this.equipmentService.load().subscribe({
      next: list => this.applyEquipmentBreakdown(list),
      error: () => this.applyEquipmentBreakdown(this.equipmentService.getAll())
    });
  }

  private applyEquipmentBreakdown(list: Equipment[]): void {
    const total = list.length;

    const byType = new Map<string, number>();
    for (const e of list) {
      const label = e.type?.trim() || 'Non renseigné';
      byType.set(label, (byType.get(label) ?? 0) + 1);
    }
    this.categoryBreakdown = Array.from(byType.entries())
      .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    this.enMaintenance = list.filter(e => e.statut === 'Inspection').length;
  }

  /**
   * Établit la référence (plus grand id déjà connu) puis lance le sondage —
   * identique au principe de alerts-page.loadRealAlertes/baselineMaxAlertId.
   */
  private loadRecentAlerts(): void {
    this.alertsLoading = true;
    this.http.get<{ data: RealAlerte[] }>(`${environment.apiUrl}/alertes`).subscribe({
      next: res => {
        const data = res.data ?? [];
        this.baselineMaxAlertId = data.length > 0 ? Math.max(...data.map(a => a.id)) : 0;
        this.alertsLoading = false;
        this.applySessionAlerts([]);
        this.alertesPollingSubscription = interval(DashboardComponent.ALERTES_POLL_MS).subscribe(() => {
          this.pollRecentAlerts();
        });
      },
      error: () => {
        this.baselineMaxAlertId = 0;
        this.alertsLoading = false;
      }
    });
  }

  private pollRecentAlerts(): void {
    if (this.baselineMaxAlertId === null) return;
    this.http.get<{ data: RealAlerte[] }>(`${environment.apiUrl}/alertes`).subscribe({
      next: res => {
        const fresh = (res.data ?? []).filter(a => a.id > this.baselineMaxAlertId!);
        this.applySessionAlerts(fresh);
      },
      error: () => { /* backend temporairement indisponible : on garde le dernier état connu */ }
    });
  }

  private applySessionAlerts(fresh: RealAlerte[]): void {
    this.alerteActive = fresh.length;
    this.recentAlerts = fresh
      .slice()
      .sort((a, b) => new Date(b.horodatage).getTime() - new Date(a.horodatage).getTime())
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: `${TYPE_ALERTE_LABELS[a.type_alerte] ?? a.type_alerte} — ${a.equipement?.nom || a.equipement?.reference || a.device_id}`,
        time: this.relativeTime(a.horodatage),
        equipementId: a.equipement?.reference
      }));
  }

  private loadRecentActivities(): void {
    this.activitiesLoading = true;
    this.http.get<{ data: RealIncident[] }>(`${environment.apiUrl}/incidents`).subscribe({
      next: res => {
        this.activitiesLoading = false;
        this.recentActivities = (res.data ?? [])
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map(i => ({
            id: i.id,
            title: `${i.type} — ${i.equipement?.nom || i.equipement?.reference || 'Équipement'}`,
            time: this.relativeTime(i.created_at),
            status: INCIDENT_STATUS_LABELS[i.status] ?? i.status,
            statusClass: i.status === 'resolu' ? 'status-done' : i.status === 'en_cours' ? 'status-progress' : 'status-pending',
            equipementId: i.equipement?.reference
          }));
      },
      error: () => {
        this.activitiesLoading = false;
        this.recentActivities = [];
      }
    });
  }

  /** "Il y a X min/h/j" — pas de service de temps relatif partagé dans l'app actuellement. */
  private relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
  }

  /** Génère le style conic-gradient pour un cercle de progression */
  getProgressStyle(percent: number, color: string): string {
    const p = Math.min(100, Math.max(0, percent));
    return `conic-gradient(${color} 0% ${p}%, #E2E8F0 ${p}% 100%)`;
  }

  /**
   * Dégradé du donut "Répartition par statut", calculé sur les vraies
   * proportions (en ligne / hors ligne / en maintenance) — remplace un
   * conic-gradient figé en dur dans le CSS (90/8/2 %) qui ne reflétait
   * jamais les vraies données, seule la légende à côté était mise à jour.
   */
  get donutGradient(): string {
    const total = this.enLigne + this.horsLigne + this.enMaintenance;
    if (total === 0) return 'conic-gradient(#E2E8F0 0% 100%)';
    const p1 = (this.enLigne / total) * 100;
    const p2 = p1 + (this.horsLigne / total) * 100;
    return `conic-gradient(#10B981 0% ${p1}%, #ff0000 ${p1}% ${p2}%, #ffe500 ${p2}% 100%)`;
  }

  get totalEquipementsPourcent(): number {
    return 100;
  }

  get enLignePourcent(): number {
    return this.totalEquipements > 0 ? Math.round((this.enLigne / this.totalEquipements) * 100) : 0;
  }

  get alerteActivePourcent(): number {
    return this.totalEquipements > 0 ? Math.round((this.alerteActive / this.totalEquipements) * 100) : 0;
  }

  get anomalieDetecteePourcent(): number {
    return this.totalEquipements > 0 ? Math.round((this.anomalieDetectee / this.totalEquipements) * 100) : 0;
  }
}
