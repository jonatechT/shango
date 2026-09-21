import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BasePageComponent } from '../base-page/base-page';
import { EquipmentService, Equipment } from '../../services/equipment.service';
import { EquipmentFormModalComponent } from '../equipment-form-page/equipment-form-modal';

type FilterScope = 'tous' | 'client' | 'id' | 'date' | 'equipement';

@Component({
  selector: 'app-equipment-list-page',
  standalone: true,
  imports: [FormsModule, BasePageComponent, EquipmentFormModalComponent],
  template: `
    <app-base-page
      [title]="pageTitle"
      [subtitle]="pageSubtitle"
      icon="fa-solid fa-location-dot"
    >
      <div page-actions>
        <button type="button" class="equip-add-btn" (click)="ajouterEquipement()">
          <i class="fa-solid fa-plus"></i>
          <span>Ajouter un équipement</span>
        </button>
      </div>
      <app-equipment-form-modal #eqmModal />
      <div class="equip-content">
        <!-- KPI Cards -->
        <div class="stat-grid">
          <div class="stat-card stat-card--blue">
            <div class="stat-main">
              <span class="stat-label">{{ enLigneMode ? 'Équipements non bloqués' : 'Équipements localisés' }}</span>
              <span class="stat-value"><strong>{{ enLigneMode ? kpiEnLigne : kpiLocalises }}</strong></span>
            </div>
            <i class="fa-solid fa-cube stat-icon stat-icon--blue"></i>
          </div>
          <div class="stat-card stat-card--red">
            <div class="stat-main">
              <span class="stat-label">Bloqués</span>
              <span class="stat-value"><strong>{{ kpiBloques }}</strong></span>
            </div>
            <i class="fa-solid fa-lock stat-icon stat-icon--red"></i>
          </div>
          <div class="stat-card stat-card--green">
            <div class="stat-main">
              <span class="stat-label">En ligne</span>
              <span class="stat-value"><strong>{{ kpiEnLigne }}</strong></span>
            </div>
            <i class="fa-solid fa-wifi stat-icon stat-icon--green"></i>
          </div>
        </div>

<!-- ===== Filtres ===== -->
        <div class="filter-bar">
          <div class="filter-scope-select">
            <button type="button" class="filter-scope-trigger" (click)="toggleFilterScope()">
              <i [class]="'fa-solid ' + currentFilterScope.icon"></i>
              <span>{{ currentFilterScope.label }}</span>
              <i class="fa-solid fa-chevron-down filter-scope-chevron"></i>
            </button>
            @if (filterScopeOpen) {
              <div class="filter-scope-backdrop" (click)="closeFilterScope()"></div>
              <div class="filter-scope-menu" role="listbox">
                @for (opt of filterScopeOptions; track opt.value) {
                  <button type="button" class="filter-scope-option" [class.active]="filterScope === opt.value" (click)="selectFilterScope(opt.value)">
                    <i [class]="'fa-solid ' + opt.icon"></i>
                    <span>{{ opt.label }}</span>
                    @if (filterScope === opt.value) { <i class="fa-solid fa-check filter-scope-check"></i> }
                  </button>
                }
              </div>
            }
          </div>
          <div class="filter-search-field">
            <i class="fa-solid fa-magnifying-glass filter-field-icon"></i>
            <input type="text" class="filter-input" [placeholder]="filterPlaceholder" [(ngModel)]="filterQuery" />
            @if (filterQuery) {
              <button type="button" class="filter-clear-btn" (click)="filterQuery = ''" aria-label="Effacer">
                <i class="fa-solid fa-xmark"></i>
              </button>
            }
          </div>
          @if (hasActiveFilters) {
            <button type="button" class="filter-reset-btn" (click)="resetFilters()">
              <i class="fa-solid fa-rotate-left"></i>
              Réinitialiser
            </button>
          }
        </div>

<!-- Tableau : Client | Équipement | ID | Mise en ligne | Détail (bouton "Voir") -->
        @if (filteredEquipments.length === 0) {
          <div class="empty-state">
            <i class="fa-solid fa-filter-circle-xmark empty-icon"></i>
            <p>Aucun équipement ne correspond à ces filtres.</p>
          </div>
        } @else {
        <div class="table-card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Équipement</th>
                  <th>ID</th>
                  <th>Mise en ligne</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                @for (eq of filteredEquipments; track eq.id; let i = $index) {
                  <tr class="row-clickable equip-row-animate" [style.animation-delay.ms]="70 * i" (click)="ouvrirDetail(eq.id)">
                    <td><span class="client-name">{{ eq.clientNom || '—' }}</span></td>
                    <td>
                      <div class="equipment-cell">
                        <span class="equipment-name">{{ eq.nom }}</span>
                      </div>
                    </td>
                    <td><span class="id-code">{{ eq.id }}</span></td>
                    <td><span class="sync-time">{{ eq.miseEnLigne }}</span></td>
                    <td class="detail-cell">
                      <button class="btn-detail" (click)="ouvrirDetail(eq.id); $event.stopPropagation()">
                        Voir
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        }
      </div>
    </app-base-page>
  `,
  styles: [`
    .equip-content { display: flex; flex-direction: column; gap: 24px; width: 100%; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .stat-card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 20px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      color: #0F172A;
      border: 1px solid rgba(15, 23, 42, 0.06);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      min-width: 0;
      min-height: 124px;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .stat-card:hover { box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); transform: translateY(-2px); }
    .stat-main { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
    .stat-label { font-size: 13px; font-weight: 600; color: #475569; letter-spacing: 0.2px; }
    .stat-value { font-size: 30px; font-weight: 700; line-height: 1.05; color: #0F172A; }
    .stat-value strong { font-size: 1em; }
    .stat-icon { font-size: 20px; flex-shrink: 0; }

    /* Variantes de couleur (même pattern que maintenance/rapports) — le dark mode global les surcharge */
    .stat-card--blue { background: #DBEAFE; border-color: rgba(59, 130, 246, 0.24); }
    .stat-icon--blue { color: #3B82F6; }
    .stat-card--red { background: #FEE2E2; border-color: rgba(239, 68, 68, 0.24); }
    .stat-icon--red { color: #EF4444; }
    .stat-card--green { background: #D1FAE5; border-color: rgba(16, 185, 129, 0.24); }
    .stat-icon--green { color: #10B981; }

    /* ===== Filtres : sélecteur de portée + champ de recherche ===== */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    /* --- Sélecteur "portée" (Tous / Client / ID / Date / Équipement) --- */
    .filter-scope-select { position: relative; flex: 0 0 190px; }
    .filter-scope-trigger {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13.5px;
      font-weight: 600;
      font-family: inherit;
      color: #1E293B;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.15s ease;
    }
    .filter-scope-trigger i:first-child { color: #2563EB; font-size: 13px; }
    .filter-scope-trigger span { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filter-scope-trigger:hover { border-color: #93C5FD; background-color: #F8FAFC; }
    .filter-scope-chevron { font-size: 11px; color: #94A3B8; }

    .filter-scope-backdrop { position: fixed; inset: 0; z-index: 55; }
    .filter-scope-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: 56;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: filterScopeIn 0.16s ease both;
    }
    @keyframes filterScopeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .filter-scope-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 10px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13.5px;
      color: #334155;
      text-align: left;
      transition: background-color 0.12s ease, color 0.12s ease;
    }
    .filter-scope-option i:first-child { color: #94A3B8; font-size: 12px; width: 14px; text-align: center; }
    .filter-scope-option span { flex: 1; }
    .filter-scope-option:hover { background-color: #EFF6FF; }
    .filter-scope-option.active { background-color: #EFF6FF; color: #1D4ED8; font-weight: 600; }
    .filter-scope-option.active i:first-child { color: #2563EB; }
    .filter-scope-check { color: #2563EB; font-size: 11px; }

    /* --- Champ de recherche --- */
    .filter-search-field {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 9px 14px;
      flex: 1 1 260px;
      min-width: 200px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .filter-search-field:focus-within {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    .filter-field-icon { color: #94A3B8; font-size: 13px; flex-shrink: 0; }
    .filter-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13.5px;
      font-family: inherit;
      color: #0F172A;
      min-width: 0;
    }
    .filter-input::placeholder { color: #94A3B8; }
    .filter-clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 50%;
      background: #E2E8F0;
      color: #64748B;
      font-size: 10px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .filter-clear-btn:hover { background: #CBD5E1; color: #334155; }

    .filter-reset-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #F1F5F9;
      color: #475569;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s ease;
    }
    .filter-reset-btn:hover { background: #E2E8F0; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 48px 24px;
      color: #94A3B8;
      text-align: center;
    }
    .empty-icon { font-size: 32px; color: #CBD5E1; }

    @media (max-width: 640px) {
      .filter-scope-select { flex: 1 1 100%; }
      .filter-search-field { flex: 1 1 100%; }
    }

    /* ===== Tableau (design conservé) ===== */
    .table-card { background: transparent; border: none; border-radius: 0; padding: 0; overflow: visible; box-shadow: none; }
    .table-wrapper { overflow-x: auto; border: none; border-radius: 0; }
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; font-size: 13px; }

    .data-table thead th {
      text-align: left;
      padding: 14px 18px;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: #2563EB;
      border-bottom: 1px solid #2563EB;
      vertical-align: middle;
    }
    .data-table thead th:first-child { border-radius: 8px 0 0 8px; }
    .data-table thead th:last-child { border-radius: 0 8px 8px 0; text-align: right; }

    .data-table tbody tr { transition: background-color 0.15s ease, border-color 0.15s ease; background-color: #FFFFFF; }
    .data-table tbody td {
      background-color: #FFFFFF;
      padding: 16px 18px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #E2E8F0;
      color: #334155;
      font-weight: 400;
      font-size: 14px;
      vertical-align: middle;
    }
    .data-table tbody td:first-child { border-left: 1px solid #E2E8F0; border-radius: 8px 0 0 8px; }
    .data-table tbody td:last-child { border-right: 1px solid #E2E8F0; border-radius: 0 8px 8px 0; text-align: right; }
    .detail-cell { white-space: nowrap; }

    /* Ligne cliquable */
    .row-clickable { cursor: pointer; }
    .row-clickable:hover td { background-color: #F8FAFC; border-color: #BFDBFE; }

    .equipment-cell { display: flex; align-items: center; gap: 10px; }
    .equipment-name { font-weight: 600; color: #1E293B; font-size: 15px; }
    .id-code { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 13px; font-weight: 600; color: #475569; letter-spacing: 0.3px; }
    .client-name { font-size: 13.5px; color: #334155; }
    .sync-time { color: #64748B; font-size: 14px; }
    /* Bouton Voir (petit badge bleu autour du mot) */
    .btn-detail {
      background-color: transparent;
      color: #2563EB;
      border: 1px solid #2563EB;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .btn-detail:hover { background-color: #2563EB; color: #FFFFFF; }

    /* ===== Apparition en cascade des lignes (comme les autres listes Shango) ===== */
    .equip-row-animate {
      animation: equipRowIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes equipRowIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .equip-row-animate {
        animation: none !important;
      }
    }

    /* Bouton d'ajout d'équipement (en-tête de page) */
    .equip-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #2563EB;
      color: #FFFFFF;
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13.5px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
      white-space: nowrap;
    }
    .equip-add-btn:hover {
      background: #1D4ED8;
      transform: translateY(-1px);
    }
    .equip-add-btn i { font-size: 13px; }

    @media (max-width: 1024px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .stat-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class EquipmentListPageComponent {
  /** Référence à la modale « Ajouter un équipement » */
  @ViewChild('eqmModal') eqmModal?: EquipmentFormModalComponent;

  /** Liste affichée (filtrée en mode « en ligne » : seuls les équipements non bloqués). */
  equipments: Equipment[] = [];
  /** Vrai quand la page est affichée via la route /location/en-ligne. */
  enLigneMode = false;

  /** Titre / sous-titre adaptés au mode. */
  pageTitle = "Parc d'équipement";
  pageSubtitle = 'Suivi en temps réel de vos équipements sur la carte.';

  /** Parc complet (non filtré par le mode « en ligne »), pour calculer les KPI. */
  private allEquipments: Equipment[] = [];

  /** Total réel du parc (issu du backend). */
  protected get kpiLocalises(): number {
    return this.allEquipments.length;
  }
  /** Équipements bloqués (`etat_kit` = BLOQUE côté backend). */
  protected get kpiBloques(): number {
    return this.allEquipments.filter(e => e.bloque).length;
  }
  /** « En ligne » = non bloqués (même sémantique que la page /equipements/en-ligne). */
  protected get kpiEnLigne(): number {
    return this.allEquipments.filter(e => !e.bloque).length;
  }

  constructor(
    private equipmentService: EquipmentService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.enLigneMode = this.route.snapshot.data['enLigne'] === true;

    if (this.enLigneMode) {
      this.pageTitle = 'Équipements en ligne';
      this.pageSubtitle = 'Équipements du parc actuellement non bloqués.';
    }

    // Affichage immédiat depuis le cache local, puis rafraîchissement depuis
    // le vrai backend (GET /api/equipements) dès qu'il répond.
    this.applyEquipments(this.equipmentService.getAll());
    this.equipmentService.load().subscribe(list => this.applyEquipments(list));
  }

  private applyEquipments(all: Equipment[]): void {
    this.allEquipments = all;
    // Seuls les équipements non bloqués apparaissent sur la page "en ligne".
    // Les KPI (calculés sur allEquipments) restent ceux du parc complet.
    this.equipments = this.enLigneMode ? all.filter(e => !e.bloque) : all;
  }

  // ===== Filtre : un champ de recherche + un sélecteur de portée =====
  filterQuery = '';
  filterScope: FilterScope = 'tous';
  protected filterScopeOpen = false;

  protected readonly filterScopeOptions: { value: FilterScope; label: string; icon: string }[] = [
    { value: 'tous', label: 'Tous', icon: 'fa-list' },
    { value: 'client', label: 'Client', icon: 'fa-user' },
    { value: 'id', label: 'ID', icon: 'fa-hashtag' },
    { value: 'date', label: 'Date de mise en ligne', icon: 'fa-calendar' },
    { value: 'equipement', label: 'Équipement', icon: 'fa-cube' }
  ];

  protected get currentFilterScope() {
    return this.filterScopeOptions.find(o => o.value === this.filterScope) ?? this.filterScopeOptions[0];
  }

  protected get filterPlaceholder(): string {
    return this.filterScope === 'tous'
      ? 'Rechercher (client, ID, date, équipement)...'
      : `Rechercher par ${this.currentFilterScope.label.toLowerCase()}...`;
  }

  protected toggleFilterScope(): void {
    this.filterScopeOpen = !this.filterScopeOpen;
  }

  protected closeFilterScope(): void {
    this.filterScopeOpen = false;
  }

  protected selectFilterScope(scope: FilterScope): void {
    this.filterScope = scope;
    this.closeFilterScope();
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterQuery.trim() || this.filterScope !== 'tous';
  }

  protected get filteredEquipments(): Equipment[] {
    const q = this.filterQuery.trim().toLowerCase();
    if (!q) return this.equipments;
    return this.equipments.filter(e => {
      switch (this.filterScope) {
        case 'client': return (e.clientNom ?? '').toLowerCase().includes(q);
        case 'id': return e.id.toLowerCase().includes(q);
        case 'date': return e.miseEnLigne.toLowerCase().includes(q);
        case 'equipement': return e.nom.toLowerCase().includes(q);
        default:
          return (
            (e.clientNom ?? '').toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q) ||
            e.miseEnLigne.toLowerCase().includes(q) ||
            e.nom.toLowerCase().includes(q)
          );
      }
    });
  }

  protected resetFilters(): void {
    this.filterQuery = '';
    this.filterScope = 'tous';
  }

  ouvrirDetail(id: string): void {
    this.router.navigate(['/equipements', id]);
  }

  ajouterEquipement(): void {
    this.eqmModal?.show();
  }
}