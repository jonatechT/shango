import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePageComponent } from '../base-page/base-page';
import { MaintenanceService, MaintenanceItem } from '../../services/maintenance.service';
import { EquipmentService } from '../../services/equipment.service';
import { UsersService } from '../../services/users.service';
import { AuthService, User } from '../../auth/auth.service';
import { SettingsService } from '../../services/settings.service';
import { StructureService } from '../../superadmin/services/structure.service';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [BasePageComponent, FormsModule],
  template: `
    <app-base-page title="Alertes" subtitle="Alertes non prises en charge sur votre parc." icon="fa-solid fa-triangle-exclamation">
      <div class="alerts-content">
        <!-- KPI Cards -->
        <div class="stat-grid">
          <div class="stat-card stat-card--red">
            <div class="stat-main">
              <span class="stat-label">Alertes ouvertes</span>
              <span class="stat-value"><strong>{{ items.length }}</strong></span>
            </div>
            <i class="fa-solid fa-triangle-exclamation stat-icon stat-icon--red"></i>
          </div>
          <div class="stat-card stat-card--pink">
            <div class="stat-main">
              <span class="stat-label">Critiques</span>
              <span class="stat-value"><strong>{{ getCritiques() }}</strong></span>
            </div>
            <i class="fa-solid fa-circle-exclamation stat-icon stat-icon--pink"></i>
          </div>
          <div class="stat-card stat-card--amber">
            <div class="stat-main">
              <span class="stat-label">Avertissements</span>
              <span class="stat-value"><strong>{{ getAvertissements() }}</strong></span>
            </div>
            <i class="fa-solid fa-circle-exclamation stat-icon stat-icon--amber"></i>
          </div>
        </div>

        @if (items.length === 0) {
          <div class="empty-state">
            <i class="fa-solid fa-circle-check empty-icon"></i>
            <p>Aucune alerte en cours. Tout est sous contrôle.</p>
          </div>
        } @else {
          <!-- Barre de filtres -->
          <div class="alerts-filters">
            <div class="filter-pills">
              <button type="button" class="filter-pill" [class.active]="filtreSeverite === 'toutes'" (click)="filtreSeverite = 'toutes'">
                Toutes <span class="filter-pill-count">{{ items.length }}</span>
              </button>
              <button type="button" class="filter-pill filter-pill--critique" [class.active]="filtreSeverite === 'Critique'" (click)="filtreSeverite = 'Critique'">
                <i class="fa-solid fa-circle-exclamation"></i> Critiques <span class="filter-pill-count">{{ getCritiques() }}</span>
              </button>
              <button type="button" class="filter-pill filter-pill--avertissement" [class.active]="filtreSeverite === 'Avertissement'" (click)="filtreSeverite = 'Avertissement'">
                <i class="fa-solid fa-triangle-exclamation"></i> Avertissements <span class="filter-pill-count">{{ getAvertissements() }}</span>
              </button>
            </div>

            <div class="filter-right">
              <div class="filter-select-wrap">
                <i class="fa-solid fa-cube filter-select-icon"></i>
                <select class="filter-select" [(ngModel)]="filtreType" aria-label="Filtrer par type d'équipement">
                  <option value="toutes">Tous les types</option>
                  @for (type of typesDisponibles; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select>
              </div>

              <div class="alerts-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Rechercher un équipement (nom ou n°)..."
                  [(ngModel)]="rechercheEquipement"
                  class="alerts-search-input"
                />
                @if (rechercheEquipement) {
                  <button type="button" class="alerts-search-clear" title="Effacer" (click)="rechercheEquipement = ''">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                }
              </div>
            </div>
          </div>

          @if (itemsFiltres.length === 0) {
            <div class="empty-state">
              <i class="fa-solid fa-filter-circle-xmark empty-icon empty-icon--muted"></i>
              <p>Aucune alerte ne correspond à ces filtres.</p>
            </div>
          } @else {
          <div class="table-card">
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Équipement</th>
                    <th>Type</th>
                    <th>Sévérité</th>
                    <th>Numéro</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of itemsFiltres; track item.id) {
                    <tr (click)="ouvrirDetail(item)">
                      <td>
                        <div class="equipment-cell">
                          <span class="equipment-name">{{ item.equipment }}</span>
                        </div>
                      </td>
                      <td>{{ item.type }}</td>
                      <td>
                        @if (item.severite === 'Critique') {
                          <span class="severite-badge severite-critique"><i class="fa-solid fa-circle-exclamation"></i> Critique</span>
                        } @else {
                          <span class="severite-badge severite-avertissement"><i class="fa-solid fa-triangle-exclamation"></i> Avertissement</span>
                        }
                      </td>
                      <td><span class="numero-code">N°{{ padNumero(item.numero) }}</span></td>
                      <td class="actions-cell">
                        @if (isAdminUser()) {
                          @if (actionAdmin === 'prendre') {
                            <button class="btn-take" (click)="prendreAlerte(item); $event.stopPropagation()">
                              <i class="fa-solid fa-hand"></i>
                              Prendre
                            </button>
                          } @else {
                            <button class="btn-take" (click)="ouvrirAffectation(item); $event.stopPropagation()">
                              <i class="fa-solid fa-user-clock"></i>
                              {{ planifMode ? 'Planifier' : 'Affecter' }}
                            </button>
                          }
                        } @else if (peutPrendre(item)) {
                          <button class="btn-take" (click)="prendreAlerte(item); $event.stopPropagation()">
                            <i class="fa-solid fa-hand"></i>
                            Prendre
                          </button>
                        } @else {
                          <span class="locked-label" title="Auto-prise désactivée : attendez l'affectation de l'admin">
                            <i class="fa-solid fa-lock"></i> En attente
                          </span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          }
        }
      </div>

      <!-- Modale d'affectation / planification d'une alerte -->
      @if (showAffectModal && selectedItem) {
        <div class="affect-overlay" (click)="closeAffectModal()">
          <div class="affect-modal" role="dialog" aria-modal="true" aria-label="Affecter une intervention" (click)="$event.stopPropagation()">
            <div class="affect-modal-header">
              <div class="affect-modal-icon"><i class="fa-solid fa-user-clock"></i></div>
              <div class="affect-modal-title-block">
                <h3 class="affect-modal-title">{{ planifMode ? 'Planifier une intervention' : 'Affecter une intervention' }}</h3>
                <span class="affect-modal-subtitle">{{ selectedItem.equipment }} — {{ selectedItem.type }}</span>
              </div>
              <button type="button" class="affect-modal-close" aria-label="Fermer" (click)="closeAffectModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="affect-modal-body">
              @if (planifMode) {
                <div class="planif-fields">
                  <div class="planif-field">
                    <label class="planif-label" for="planif-date">Date de l'intervention</label>
                    <input id="planif-date" type="date" class="planif-input" [(ngModel)]="planifDate" [min]="today()" />
                  </div>
                  <div class="planif-field">
                    <label class="planif-label" for="planif-nature">Nature de l'intervention</label>
                    <input id="planif-nature" type="text" class="planif-input" [(ngModel)]="planifNature" placeholder="Ex : Préventive, Réparation moteur..." />
                  </div>
                </div>
              } @else {
                <div class="planif-fields">
                  <div class="planif-field">
                    <label class="planif-label" for="affect-date">Date d'affectation</label>
                    <input id="affect-date" type="date" class="planif-input" [(ngModel)]="affectDate" />
                  </div>
                  <div class="planif-field">
                    <label class="planif-label" for="affect-delai">Délai</label>
                    <input id="affect-delai" type="text" class="planif-input" [(ngModel)]="affectDelai" placeholder="ex. 48 h" />
                  </div>
                </div>
              }

              <div class="planif-field">
                <label class="planif-label" for="intervention-description">Description <span class="planif-optional">(optionnel)</span></label>
                <textarea id="intervention-description" class="planif-input planif-textarea" [(ngModel)]="interventionDescription" placeholder="Précisions pour le(s) technicien(s) affecté(s)..." rows="2"></textarea>
              </div>

              @if (affectModeMulti) {
                <div class="affect-multi-note">
                  <i class="fa-solid fa-users"></i>
                  Sélectionnez un ou plusieurs techniciens (max {{ maxTechniciens }}).
                  <span class="affect-counter" [class.at-max]="selectedTechnicienIds.length >= maxTechniciens">
                    {{ selectedTechnicienIds.length }} / {{ maxTechniciens }}
                  </span>
                </div>
              }

              <div class="affect-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Rechercher un technicien..."
                  [(ngModel)]="rechercheTechnicien"
                  class="affect-search-input"
                />
              </div>

              <div class="affect-list">
                @for (tech of techniciensFiltres; track tech.id) {
                  <button
                    type="button"
                    class="affect-item"
                    [class.selected]="isTechnicienSelected(tech.id)"
                    [class.disabled]="!isTechnicienSelected(tech.id) && !peutAjouterTechnicien()"
                    (click)="toggleTechnicien(tech.id)"
                  >
                    <span class="affect-avatar">{{ tech.name.charAt(0) }}</span>
                    <span class="affect-item-info">
                      <span class="affect-item-name">
                        {{ tech.name }}
                        <span class="affect-item-structure">{{ structureLibelle(tech.structureId) }}</span>
                      </span>
                      <span class="affect-item-email">{{ tech.email }}</span>
                    </span>
                    <i class="fa-solid fa-circle-check affect-check"></i>
                  </button>
                }
                @if (techniciensFiltres.length === 0) {
                  <p class="affect-empty">Aucun technicien actif ne correspond à votre recherche.</p>
                }
              </div>
            </div>
            <div class="affect-modal-footer">
              <button type="button" class="affect-btn-cancel" (click)="closeAffectModal()">Annuler</button>
              <button
                type="button"
                class="affect-btn-confirm"
                [disabled]="!selectedTechnicienIds.length || (planifMode && !planifDate)"
                (click)="confirmerAffectation()"
              >
                <i class="fa-solid fa-user-check"></i>
                {{ planifMode ? 'Planifier' : 'Affecter' }}
              </button>
            </div>
          </div>
        </div>
      }
    </app-base-page>
  `,
  styles: [`
    .alerts-content { display: flex; flex-direction: column; gap: 24px; width: 100%; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .stat-card {
      background: #FFFFFF; border-radius: 12px; padding: 20px 22px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      color: #0F172A; border: 1px solid rgba(15, 23, 42, 0.06); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      min-width: 0; min-height: 124px; transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .stat-card:hover { box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); transform: translateY(-2px); }
    .stat-main { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
    .stat-label { font-size: 13px; font-weight: 600; color: #475569; }
    .stat-value { font-size: 30px; font-weight: 700; line-height: 1.05; color: #0F172A; }
    .stat-value strong { font-size: 1em; }
    .stat-icon { font-size: 20px; flex-shrink: 0; }
    .stat-card--red { background: #FEE2E2; border-color: rgba(239, 68, 68, 0.24); }
    .stat-icon--red { color: #DC2626; }
    .stat-card--pink { background: #FFE4E6; border-color: rgba(225, 29, 72, 0.22); }
    .stat-icon--pink { color: #E11D48; }
    .stat-card--amber { background: #FEF3C7; border-color: rgba(217, 119, 6, 0.24); }
    .stat-icon--amber { color: #D97706; }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px; background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 12px; color: #94A3B8; text-align: center; }
    .empty-icon { font-size: 32px; color: #22C55E; }
    .empty-icon--muted { color: #94A3B8; }

    /* ===== Barre de filtres ===== */
    .alerts-filters { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .filter-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filter-pill {
      display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px;
      border: 1px solid #E2E8F0; background: #FFFFFF; color: #475569; font-size: 12.5px; font-weight: 600;
      cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
    }
    .filter-pill:hover { border-color: #CBD5E1; background: #F8FAFC; }
    .filter-pill.active { background: #2563EB; border-color: #2563EB; color: #FFFFFF; }
    .filter-pill--critique.active { background: #DC2626; border-color: #DC2626; }
    .filter-pill--avertissement.active { background: #D97706; border-color: #D97706; }
    .filter-pill-count {
      display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px;
      padding: 0 5px; border-radius: 999px; background: rgba(15, 23, 42, 0.08); font-size: 10.5px; font-weight: 700;
    }
    .filter-pill.active .filter-pill-count { background: rgba(255, 255, 255, 0.25); }

    .filter-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-select-wrap { position: relative; display: flex; align-items: center; }
    .filter-select-icon { position: absolute; left: 12px; color: #94A3B8; font-size: 12px; pointer-events: none; }
    .filter-select {
      appearance: none; padding: 9px 32px 9px 32px; border: 1px solid #E2E8F0; border-radius: 10px;
      background: #FFFFFF; font-size: 12.5px; font-weight: 600; color: #334155; cursor: pointer;
      font-family: inherit; min-width: 170px;
    }
    .filter-select:focus { outline: none; border-color: #2563EB; }

    .alerts-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 10px; background: #FFFFFF; min-width: 260px; }
    .alerts-search i { color: #94A3B8; font-size: 13px; }
    .alerts-search-input { border: none; outline: none; background: transparent; font-size: 13px; color: #0F172A; width: 100%; font-family: inherit; }
    .alerts-search-clear { border: none; background: transparent; color: #94A3B8; cursor: pointer; padding: 2px; display: flex; align-items: center; }
    .alerts-search-clear:hover { color: #475569; }

    @media (max-width: 768px) {
      .alerts-filters { flex-direction: column; align-items: stretch; }
      .filter-right { flex-direction: column; align-items: stretch; }
      .alerts-search { min-width: 0; }
      .filter-select { width: 100%; }
    }

    .table-card { background: transparent; border: none; padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; font-size: 13px; }
    .data-table thead th {
      text-align: left; padding: 12px 14px; height: 40px; color: #FFFFFF; font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.5px; background-color: #2563EB; vertical-align: middle;
    }
    .data-table thead th:first-child { border-radius: 8px 0 0 8px; }
    .data-table thead th:last-child { text-align: right; border-radius: 0 8px 8px 0; }
    .data-table tbody tr { background-color: #FFFFFF; cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; }
    .data-table tbody td { background-color: #FFFFFF; padding: 13px 14px; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; color: #334155; vertical-align: middle; }
    .data-table tbody td:first-child { border-left: 1px solid #E2E8F0; border-radius: 8px 0 0 8px; font-weight: 600; color: #1E293B; }
    .data-table tbody td:last-child { border-right: 1px solid #E2E8F0; border-radius: 0 8px 8px 0; text-align: right; }
    .data-table tbody tr:hover td { background-color: #F8FAFC; border-color: #BFDBFE; }

    .equipment-cell { display: flex; align-items: center; gap: 10px; }
    .equipment-name { font-weight: 600; color: #0F172A; font-size: 13px; }
    .numero-code { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 12px; color: #64748B; }

    .severite-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .severite-critique { background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; }
    .severite-avertissement { background: #FEF3C7; color: #D97706; border: 1px solid #FCD39D; }

    .btn-take { background: transparent; color: #2563EB; border: 1px solid #2563EB; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; white-space: nowrap; }
    .btn-take:hover { background: #2563EB; color: #FFFFFF; }
    .locked-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #94A3B8; font-weight: 600; }

    @media (max-width: 1024px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) { .stat-grid { grid-template-columns: 1fr; } }

    /* ===== Modale d'affectation (portée depuis l'ancienne page Alertes) ===== */
    .affect-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .affect-modal { background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 420px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); }
    .affect-modal-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #E2E8F0; }
    .affect-modal-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #EFF6FF; color: #2563EB; font-size: 18px; flex-shrink: 0; }
    .affect-modal-title-block { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .affect-modal-title { margin: 0; font-size: 15px; font-weight: 700; color: #0F172A; }
    .affect-modal-subtitle { font-size: 11.5px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .affect-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: #64748B; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
    .affect-modal-close:hover { background: #F1F5F9; color: #0F172A; }
    .affect-modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
    .affect-list { display: flex; flex-direction: column; gap: 8px; }
    .affect-item, .affect-self { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid #E2E8F0; background: #FFFFFF; cursor: pointer; transition: all 0.15s ease; }
    .affect-item:hover, .affect-self:hover { border-color: #BFDBFE; background: #F8FAFC; }
    .affect-item.selected, .affect-self.selected { border-color: #2563EB; background: #EFF6FF; box-shadow: 0 0 0 1px #2563EB; }
    .affect-avatar { width: 34px; height: 34px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .affect-item-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .affect-item-name { font-size: 13px; font-weight: 600; color: #0F172A; }
    .affect-item-email { font-size: 11.5px; color: #64748B; }
    .affect-check { color: #2563EB; opacity: 0; transition: opacity 0.15s ease; }
    .affect-item.selected .affect-check, .affect-self.selected .affect-check { opacity: 1; }
    .affect-empty { font-size: 13px; color: #64748B; text-align: center; padding: 12px 0; }
    .affect-multi-note { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #64748B; padding: 10px 20px 4px; }
    .affect-counter { margin-left: auto; font-weight: 700; color: #2563EB; background: #EFF6FF; border-radius: 12px; padding: 2px 8px; font-size: 11px; }
    .affect-counter.at-max { color: #DC2626; background: #FEE2E2; }
    /* Recherche dans la liste des techniciens (plateforme entière) */
    .affect-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; }
    .affect-search i { color: #94A3B8; font-size: 13px; }
    .affect-search-input { border: none; outline: none; background: transparent; font-size: 13px; color: #0F172A; width: 100%; font-family: inherit; }
    /* Champs date + nature pour la planification */
    .planif-fields { display: flex; flex-direction: column; gap: 10px; padding: 10px 20px 4px; }
    .planif-field { display: flex; flex-direction: column; gap: 4px; }
    .planif-label { font-size: 11.5px; font-weight: 700; color: #475569; }
    .planif-input { padding: 8px 10px; border: 1px solid #E2E8F0; border-radius: 9px; font-size: 13px; color: #0F172A; outline: none; font-family: inherit; background: #FFFFFF; }
    .planif-input:focus { border-color: #2563EB; }
    .planif-textarea { resize: vertical; min-height: 56px; line-height: 1.5; }
    .planif-optional { font-weight: 500; color: #94A3B8; text-transform: none; letter-spacing: 0; }
    .affect-item.disabled { opacity: 0.5; cursor: not-allowed; }
    .affect-item.disabled:hover { border-color: #E2E8F0; background: #FFFFFF; }
    .affect-item-structure { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 600; color: #64748B; background: #F1F5F9; border-radius: 8px; padding: 1px 6px; vertical-align: middle; }
    .affect-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #E2E8F0; }
    .affect-btn-cancel { padding: 8px 16px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #475569; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
    .affect-btn-cancel:hover { background: #F1F5F9; }
    .affect-btn-confirm { padding: 8px 18px; border-radius: 8px; border: none; background: #2563EB; color: #FFFFFF; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .affect-btn-confirm:hover { background: #1D4ED8; }
    .affect-btn-confirm:disabled { background: #CBD5E1; cursor: not-allowed; }
  `]
})
export class AlertsPageComponent {
  showAffectModal = false;
  selectedItem: MaintenanceItem | null = null;
  selectedTechnicienIds: number[] = [];
  /** Recherche libre dans la liste des techniciens (plateforme entière). */
  rechercheTechnicien = '';
  /** Date choisie pour une intervention planifiée (format ISO yyyy-mm-dd). */
  planifDate = '';
  planifNature = '';
  /** Date d'affectation et délai saisis par l'admin lors d'une simple affectation. */
  affectDate = '';
  affectDelai = '';
  /** Description libre (optionnelle) transmise aux techniciens affectés via la notification. */
  interventionDescription = '';

  /** Filtre de sévérité actif sur la liste des alertes. */
  filtreSeverite: 'toutes' | 'Critique' | 'Avertissement' = 'toutes';
  /** Filtre de type d'équipement actif ('toutes' = tous les types). */
  filtreType = 'toutes';
  /** Recherche libre par nom d'équipement ou numéro d'alerte. */
  rechercheEquipement = '';

  constructor(
    private maintenanceService: MaintenanceService,
    private equipmentService: EquipmentService,
    private usersService: UsersService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private structureService: StructureService,
    private router: Router
  ) {}

  get items(): MaintenanceItem[] {
    const sid = this.authService.getUser()?.structureId || null;
    // Chaque structure ne voit que SES alertes (le SuperAdmin, sans structureId, voit tout).
    return this.maintenanceService.getItems().filter(i => !i.prisPar && i.alertes > 0 && (!sid || i.structureId === sid));
  }

  /** Types d'équipement présents dans les alertes courantes (pour la liste déroulante de filtre). */
  get typesDisponibles(): string[] {
    return Array.from(new Set(this.items.map(i => i.type))).sort((a, b) => a.localeCompare(b));
  }

  /** Alertes après application des filtres (sévérité, type d'équipement, recherche). */
  get itemsFiltres(): MaintenanceItem[] {
    const q = this.rechercheEquipement.trim().toLowerCase();
    return this.items.filter(item => {
      if (this.filtreSeverite !== 'toutes' && item.severite !== this.filtreSeverite) return false;
      if (this.filtreType !== 'toutes' && item.type !== this.filtreType) return false;
      if (q) {
        const matchNom = item.equipment.toLowerCase().includes(q);
        const matchNumero = this.padNumero(item.numero).includes(q) || item.numero.toString().includes(q);
        if (!matchNom && !matchNumero) return false;
      }
      return true;
    });
  }

  getCritiques(): number {
    return this.items.filter(i => i.severite === 'Critique').length;
  }

  getAvertissements(): number {
    return this.items.filter(i => i.severite === 'Avertissement').length;
  }

  padNumero(numero: number): string {
    return numero.toString().padStart(3, '0');
  }

  isAdminUser(): boolean {
    return this.authService.isStructureAdmin() || this.authService.isSuperAdmin();
  }

  get affectModeMulti(): boolean {
    return this.settingsService.settings().multiTechniciens;
  }

  get maxTechniciens(): number {
    const max = this.settingsService.settings().maxTechniciens;
    return Math.max(1, max || 1);
  }

  get canTakeAlerts(): boolean {
    return this.settingsService.settings().priseEnChargeGlobale;
  }

  /**
   * Un technicien peut prendre une alerte si l'auto-prise globale est active,
   * OU s'il a été explicitement affecté à cette alerte par l'admin.
   */
  peutPrendre(item: MaintenanceItem): boolean {
    if (this.canTakeAlerts) return true;
    const moi = this.currentUserName;
    return !!item.affectes?.some(a => a.nom === moi);
  }

  /** Action unique proposée à l'admin sur une alerte (choisie dans /parametres). */
  get actionAdmin(): 'affecter' | 'planifier' | 'prendre' {
    return this.settingsService.settings().actionAdmin;
  }

  get planifMode(): boolean {
    return this.actionAdmin === 'planifier';
  }

  /** Date du jour au format ISO (pour l'attribut min des champs date). */
  today(): string {
    const d = new Date();
    const p = (v: number) => v.toString().padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  get currentUserName(): string {
    return this.authService.getUser()?.name || 'Utilisateur';
  }

  get techniciensDisponibles(): User[] {
    // Un admin de structure ne voit que les techniciens DE SA PROPRE STRUCTURE.
    // Seul le SuperAdmin (qui n'a pas de structureId) voit toute la plateforme.
    const maStructureId = this.authService.getUser()?.structureId;
    return this.usersService
      .getAllUsers()
      .filter(u => u.role === 'USER' && (u.statut ?? 'ACTIVE') === 'ACTIVE')
      .filter(u => !maStructureId || u.structureId === maStructureId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get techniciensFiltres(): User[] {
    const q = this.rechercheTechnicien.trim().toLowerCase();
    if (!q) return this.techniciensDisponibles;
    return this.techniciensDisponibles.filter(
      t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }

  /** Le quota de techniciens (défini dans /parametres) est-il atteint ? */
  peutAjouterTechnicien(): boolean {
    return this.selectedTechnicienIds.length < this.maxTechniciens;
  }

  /** Affiche le nom de la structure d'un technicien (ou son id). */
  structureLibelle(structureId?: string): string {
    if (!structureId) return '';
    return this.structureService.getStructure(structureId)?.nom || structureId;
  }

  prendreAlerte(item: MaintenanceItem): void {
    const success = this.maintenanceService.prendreAlerte(item.id, this.currentUserName);
    if (success) {
      this.router.navigate(['/maintenance'], { queryParams: { taken: '1' } });
    }
  }

  ouvrirAffectation(item: MaintenanceItem): void {
    this.selectedItem = item;
    this.selectedTechnicienIds = [];
    this.rechercheTechnicien = '';
    this.planifDate = '';
    this.planifNature = 'Préventive';
    this.affectDate = '';
    this.affectDelai = '';
    this.interventionDescription = '';
    this.showAffectModal = true;
  }

  closeAffectModal(): void {
    this.showAffectModal = false;
    this.selectedItem = null;
    this.selectedTechnicienIds = [];
    this.rechercheTechnicien = '';
    this.interventionDescription = '';
  }

  isTechnicienSelected(id: number): boolean {
    return this.selectedTechnicienIds.includes(id);
  }

  toggleTechnicien(id: number): void {
    if (!this.affectModeMulti) {
      // Mono-affectation : la sélection remplace.
      this.selectedTechnicienIds = this.selectedTechnicienIds.includes(id) ? [] : [id];
      return;
    }
    if (this.selectedTechnicienIds.includes(id)) {
      this.selectedTechnicienIds = this.selectedTechnicienIds.filter(x => x !== id);
    } else if (this.peutAjouterTechnicien()) {
      this.selectedTechnicienIds = [...this.selectedTechnicienIds, id];
    }
  }

  confirmerAffectation(): void {
    if (!this.selectedItem || this.selectedTechnicienIds.length === 0) return;
    const item = this.selectedItem;
    const techniciens = this.selectedTechnicienIds
      .map(id => this.techniciensDisponibles.find(t => t.id === id))
      .filter((t): t is User => !!t)
      .map(t => ({ id: t.id, nom: t.name }));

    const description = this.interventionDescription.trim() || undefined;

    if (this.planifMode) {
      if (!this.planifDate) return;
      this.maintenanceService.planifierIntervention(item.id, {
        nature: this.planifNature || 'Préventive',
        natures: this.planifNature ? [this.planifNature] : [],
        date: this.planifDate,
        techniciens,
        description
      });
      this.closeAffectModal();
      this.router.navigate(['/maintenance'], { queryParams: { planifie: '1' } });
      return;
    }

    this.maintenanceService.affecterAlerte(item.id, techniciens, this.affectDate || undefined, this.affectDelai || undefined, description);
    this.closeAffectModal();
    this.router.navigate(['/maintenance'], { queryParams: { affecte: '1' } });
  }

  ouvrirDetail(item: MaintenanceItem): void {
    const equipment = this.equipmentService.getOrCreateByName(item.equipment, {
      localisation: item.localisation,
      lienLocalisation: item.lienLocalisation
    });
    this.router.navigate(['/equipements', equipment.id], { queryParams: { source: 'alerts' } });
  }
}
