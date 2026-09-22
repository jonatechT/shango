import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
export class DashboardComponent implements OnInit {

  /** true tant que GET /api/dashboard n'a pas répondu (évite d'afficher des zéros trompeurs). */
  statsLoading = true;
  statsError: string | null = null;

  totalEquipements = 0;
  enLigne = 0;
  /** "Hors ligne" = bloqué (etat_kit=BLOQUE) — pas de notion distincte côté backend. */
  horsLigne = 0;
  /** Compté sur le parc réel chargé (statut='Inspection', voir loadEquipmentBreakdown) — pas fourni par /api/dashboard. */
  enMaintenance = 0;
  /** Alertes non résolues (nouvelles + en cours), pas le seul total. */
  alerteActive = 0;
  /** Aucune notion "d'anomalie" distincte côté backend : incidents_total sert de proxy honnête. */
  anomalieDetectee = 0;

  /** Répartition par type d'équipement (raw.type du backend) — calculée sur le parc réel, pas fournie par /api/dashboard. */
  categoryBreakdown: { label: string; count: number; percent: number }[] = [];

  /** Alertes récentes réelles — GET /api/alertes, triées, 5 dernières. */
  recentAlerts: { id: number; title: string; time: string; equipementId?: string }[] = [];
  alertsLoading = true;

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
        this.alerteActive = s.alertes_nouvelles + s.alertes_en_cours;
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

  private loadRecentAlerts(): void {
    this.alertsLoading = true;
    this.http.get<{ data: RealAlerte[] }>(`${environment.apiUrl}/alertes`).subscribe({
      next: res => {
        this.alertsLoading = false;
        this.recentAlerts = (res.data ?? [])
          .slice()
          .sort((a, b) => new Date(b.horodatage).getTime() - new Date(a.horodatage).getTime())
          .slice(0, 5)
          .map(a => ({
            id: a.id,
            title: `${TYPE_ALERTE_LABELS[a.type_alerte] ?? a.type_alerte} — ${a.equipement?.nom || a.equipement?.reference || a.device_id}`,
            time: this.relativeTime(a.horodatage),
            equipementId: a.equipement?.reference
          }));
      },
      error: () => {
        this.alertsLoading = false;
        this.recentAlerts = [];
      }
    });
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
