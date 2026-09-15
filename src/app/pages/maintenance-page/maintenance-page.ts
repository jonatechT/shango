import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePageComponent } from '../base-page/base-page';
import { MaintenanceService, MaintenanceItem } from '../../services/maintenance.service';
import { EquipmentService } from '../../services/equipment.service';
import { UsersService } from '../../services/users.service';
import { SettingsService } from '../../services/settings.service';
import { AuthService, User } from '../../auth/auth.service';
import { StructureService } from '../../superadmin/services/structure.service';

@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [BasePageComponent, FormsModule],
  template: `
    <app-base-page title="Maintenance" subtitle="Planification et suivi des interventions de maintenance." icon="fa-solid fa-wrench">
      <div class="maintenance-content">
        <!-- Barre d'actions : bouton Planifier (admin, si l'option est active dans /parametres) -->
        <div class="maintenance-actions-bar">
          <div></div>
          @if (canPlanifier) {
            <button class="btn-planifier-top" (click)="ouvrirPlanification()">
              <i class="fa-solid fa-calendar-plus"></i> Planifier une intervention
            </button>
          }
        </div>

        <!-- KPI Cards -->
        <div class="stat-grid">
          <div class="stat-card stat-card--blue">
            <div class="stat-main">
              <span class="stat-label">En cours</span>
              <span class="stat-value"><strong>{{ getEnCours() }}</strong></span>
            </div>
            <i class="fa-solid fa-spinner stat-icon stat-icon--blue"></i>
          </div>
          <div class="stat-card stat-card--green">
            <div class="stat-main">
              <span class="stat-label">Terminées</span>
              <span class="stat-value"><strong>{{ getTerminees() }}</strong></span>
            </div>
            <i class="fa-solid fa-circle-check stat-icon stat-icon--green"></i>
          </div>
          <div class="stat-card stat-card--pink">
            <div class="stat-main">
              <span class="stat-label">Planifiées</span>
              <span class="stat-value"><strong>{{ getPlanifiees() }}</strong></span>
            </div>
            <i class="fa-solid fa-calendar-days stat-icon stat-icon--pink"></i>
          </div>
        </div>

        <!-- Retour utilisateur après une action -->
        @if (feedbackMessage()) {
          <div
            class="feedback-banner"
            [class.feedback-success]="feedbackType() === 'success'"
            [class.feedback-error]="feedbackType() === 'error'"
            role="status"
          >
            <i [class]="feedbackType() === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'"></i>
            <span>{{ feedbackMessage() }}</span>
          </div>
        }

        <!-- Tableau des maintenances -->
        <div class="table-card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Équipement</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Technicien</th>
                  <th>Numéro</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items; track item.id) {
                  <tr [class.locked-row]="!peutOuvrirDetail(item)" (click)="peutOuvrirDetail(item) && ouvrirDetail(item.id)">
                    <td>
                      <div class="equipment-cell">
                        <span class="equipment-name">{{ item.equipment }}</span>
                      </div>
                    </td>
                    <td>{{ item.type }}</td>
                    <td>{{ item.datePrevue }}</td>
                    <td>
                      @if (afficherVoirTechniciens(item)) {
                        <span class="tech-multi" [title]="techniciensAvecContacts(item)">
                          <i class="fa-solid fa-users"></i> Voir techniciens
                        </span>
                      } @else if (item.prisPar) {
                        <span
                          class="tech-badge"
                          [class.tech-mine]="item.prisPar === getCurrentUserName()"
                          [title]="item.datePrise ? 'Pris le ' + item.datePrise : ''"
                        >
                          <i class="fa-solid fa-user-gear"></i> {{ item.prisPar }}
                          @if (item.datePrise) {
                            <span class="tech-date">· {{ item.datePrise }}</span>
                          }
                        </span>
                      } @else if (item.affectes && item.affectes.length > 0) {
                        <span class="tech-badge" [class.tech-mine]="item.affectes[0].nom === getCurrentUserName()">
                          <i class="fa-solid fa-user-gear"></i> {{ item.affectes[0].nom }}
                        </span>
                      } @else {
                        <span class="tech-none">—</span>
                      }
                    </td>
                    <td>
                      @if (telephoneTechnicienPrincipal(item)) {
                        <a class="numero-code" [href]="'tel:' + telephoneTechnicienPrincipal(item)" title="Appeler le technicien" (click)="$event.stopPropagation()">
                          <i class="fa-solid fa-phone"></i> {{ telephoneTechnicienPrincipal(item) }}
                        </a>
                      } @else {
                        <span class="numero-code">—</span>
                      }
                    </td>
                    <td class="actions-cell">
                      @if (!peutOuvrirDetail(item)) {
                        <span class="locked-label" title="Intervention assignée à un autre technicien">
                          <i class="fa-solid fa-lock"></i> Assignée
                        </span>
                      } @else if (item.statut === 'En cours' && item.prisPar) {
                        <button class="btn-terminer" (click)="terminerMaintenance(item); $event.stopPropagation()">
                          <i class="fa-solid fa-flag-checkered"></i> Terminer
                        </button>
                      } @else if (item.statut !== 'Terminée' && item.alertes === 0 && !item.prisPar) {
                        <button class="btn-prendre" (click)="prendreAlerte(item); $event.stopPropagation()">
                          Prendre en charge
                        </button>
                      } @else if (item.statut === 'Terminée') {
                        <button class="btn-rapport" (click)="allerAuxRapports(); $event.stopPropagation()" title="Voir les rapports">
                          <i class="fa-solid fa-file-lines"></i> Rapport
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modale de planification d'une nouvelle intervention -->
      @if (showPlanifModal) {
        <div class="planif-overlay" (click)="fermerPlanification()">
          <div class="planif-modal" role="dialog" aria-modal="true" aria-label="Planifier une intervention" (click)="$event.stopPropagation()">
            <div class="planif-modal-header">
              <div class="planif-modal-icon"><i class="fa-solid fa-calendar-plus"></i></div>
              <div class="planif-modal-title-block">
                <h3 class="planif-modal-title">Planifier une intervention</h3>
                <span class="planif-modal-subtitle">Créer une nouvelle intervention de maintenance</span>
              </div>
              <button type="button" class="planif-modal-close" aria-label="Fermer" (click)="fermerPlanification()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="planif-modal-body">
              <div class="planif-modal-field">
                <label class="planif-modal-label" for="pf-equipement">Équipement</label>
                <select id="pf-equipement" class="planif-modal-input" [(ngModel)]="planifEquipement">
                  @for (eq of equipementsList; track eq.nom) {
                    <option [value]="eq.nom">{{ eq.nom }}</option>
                  }
                </select>
              </div>
              <div class="planif-modal-field">
                <label class="planif-modal-label" for="pf-nature">Nature de l'intervention</label>
                <input id="pf-nature" type="text" class="planif-modal-input" [(ngModel)]="planifNature" placeholder="Ex : Préventive, Réparation moteur..." />
              </div>
              <div class="planif-modal-field">
                <label class="planif-modal-label" for="pf-date">Date de l'intervention</label>
                <input id="pf-date" type="date" class="planif-modal-input" [(ngModel)]="planifDate" [min]="today()" />
              </div>
              <div class="planif-modal-field">
                <label class="planif-modal-label" for="pf-tech">Techniciens affectés</label>
                <select id="pf-tech" class="planif-modal-input" [(ngModel)]="planifTechniciensIds" multiple size="4">
                  @for (t of techniciensDisponibles; track t.id) {
                    <option [ngValue]="t.id">{{ t.name }} ({{ structureLibelle(t.structureId) }})</option>
                  }
                </select>
              </div>
            </div>
            <div class="planif-modal-footer">
              <button type="button" class="planif-btn-cancel" (click)="fermerPlanification()">Annuler</button>
              <button type="button" class="planif-btn-confirm" [disabled]="!canConfirmPlanif" (click)="confirmerPlanification()">
                <i class="fa-solid fa-calendar-check"></i> Planifier
              </button>
            </div>
          </div>
        </div>
      }
    </app-base-page>
  `,
  styles: [`
    .maintenance-content { display: flex; flex-direction: column; gap: 24px; width: 100%; }
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
    .stat-icon {
      font-size: 20px;
      flex-shrink: 0;
    }
    .stat-card--blue { background: #DBEAFE; border-color: rgba(59, 130, 246, 0.24); }
    .stat-icon--blue { color: #2563EB; }
    .stat-card--green { background: #D1FAE5; border-color: rgba(16, 185, 129, 0.24); }
    .stat-icon--green { color: #059669; }
    .stat-card--pink { background: #FFE4E6; border-color: rgba(225, 29, 72, 0.22); }
    .stat-icon--pink { color: #E11D48; }

    /* ===== Tableau moderne (wrapper sans carte) ===== */
    .table-card {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0;
      overflow: visible;
      box-shadow: none;
      margin-top: 0;
    }
    .table-wrapper {
      overflow-x: auto;
      border: none;
      border-radius: 0;
    }
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; font-size: 13px; }

    .data-table thead th {
      text-align: left;
      padding: 12px 14px;
      height: 40px;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: #2563EB;
      border-bottom: 1px solid #2563EB;
      vertical-align: middle;
    }
    .data-table thead th:first-child { border-radius: 8px 0 0 8px; }
    .data-table thead th:last-child { text-align: right; border-radius: 0 8px 8px 0; }

    .data-table tbody tr {
      transition: background-color 0.15s ease, border-color 0.15s ease;
      background-color: #FFFFFF;
      cursor: pointer;
    }
    .data-table tbody tr.active {
      background-color: #2563EB;
      color: #FFFFFF;
    }
    .data-table tbody tr.active td {
      color: #FFFFFF;
      border-color: #2563EB;
    }
    .data-table tbody td {
      background-color: #FFFFFF;
      padding: 13px 14px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #E2E8F0;
      color: #334155;
      font-weight: 400;
      vertical-align: middle;
    }
    .data-table tbody td:first-child { border-left: 1px solid #E2E8F0; border-radius: 8px 0 0 8px; color: #1E293B; font-weight: 600; font-size: 13px; }
    .data-table tbody td:last-child { border-right: 1px solid #E2E8F0; border-radius: 0 8px 8px 0; }
    .data-table tbody tr:hover td { background-color: #F8FAFC; border-color: #BFDBFE; }
    .data-table tbody tr.active:hover td { background-color: #2563EB; border-color: #2563EB; }
    .data-table tbody td:nth-child(4) {
      color: #64748B;
      font-size: 12px;
    }
    .data-table tbody td:nth-child(5) {
      color: #64748B;
      font-size: 12px;
    }
    .data-table tbody td:last-child { text-align: right; }
    .actions-cell { text-align: right; }

    /* ===== Bouton Planifier (visible si l'option est active dans /parametres) ===== */
    .btn-planifier-top { background: #2563EB; color: #FFFFFF; border: none; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .btn-planifier-top i { color: #FFFFFF; }
    .btn-planifier-top:hover { background: #1D4ED8; transform: translateY(-1px); }
    .maintenance-actions-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }

    /* ===== Modale de planification ===== */
    .planif-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .planif-modal { background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); }
    .planif-modal-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; border-bottom: 1px solid #1E40AF; background: linear-gradient(180deg, #2563EB, #1D4ED8); }
    .planif-modal-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.18); color: #FFF; font-size: 18px; flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.25); }
    .planif-modal-title-block { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .planif-modal-title { margin: 0; font-size: 15px; font-weight: 700; color: #FFFFFF; }
    .planif-modal-subtitle { font-size: 11.5px; color: rgba(255, 255, 255, 0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .planif-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255, 255, 255, 0.12); color: #FFFFFF; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
    .planif-modal-close:hover { background: rgba(255, 255, 255, 0.24); color: #FFFFFF; }
    .planif-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }
    .planif-modal-field { display: flex; flex-direction: column; gap: 6px; }
    .planif-modal-label { font-size: 12px; font-weight: 600; color: #475569; }
    .planif-modal-input { padding: 9px 12px; border: 1px solid #E2E8F0; border-radius: 9px; font-size: 13px; color: #0F172A; outline: none; font-family: inherit; background: #FFFFFF; }
    .planif-modal-input:focus { border-color: #2563EB; }
    .planif-modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 18px 24px; border-top: 1px solid #E2E8F0; }
    .planif-btn-cancel { padding: 8px 16px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #475569; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
    .planif-btn-cancel:hover { background: #F1F5F9; }
    .planif-btn-confirm { padding: 8px 18px; border-radius: 8px; border: none; background: #2563EB; color: #FFFFFF; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .planif-btn-confirm:hover { background: #1D4ED8; }
    .planif-btn-confirm:disabled { background: #CBD5E1; cursor: not-allowed; }

    .equipment-cell { display: flex; align-items: center; gap: 10px; }
    .equipment-name { font-weight: 600; color: #0F172A; font-size: 13px; }
    .location-link-page { display: inline-flex; align-items: center; gap: 6px; color: #2563EB; text-decoration: none; font-weight: 500; font-size: 12px; transition: all 0.2s ease; }
    .location-link-page:hover { color: #1D4ED8; }
    .location-link-page i { font-size: 12px; }
    .data-table tbody tr.active .location-link-page { color: #FFFFFF; }
    .data-table tbody tr.active .location-link-page:hover { color: #FFFFFF; }

    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .status-planifiee { background: #FFFBEB; color: #D97706; border: 1px solid #FCD39D; }
    .status-en-cours { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }
    .status-terminee { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
    .status-non-pris { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; }

    .alert-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .alert-active { background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; }
    .alert-none { background: #E5E7EB; color: #6B7280; border: 1px solid #D1D5DB; }

    .taken-by { margin-top: 6px; font-size: 11px; color: #059669; display: flex; align-items: center; gap: 4px; }
    .taken-by i { font-size: 11px; }

    /* Badge du technicien ayant pris l'alerte */
    .tech-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; white-space: nowrap; }
    .tech-badge i { font-size: 11px; }
    .tech-badge.tech-mine { background: #DBEAFE; color: #1D4ED8; border-color: #BFDBFE; }
    .tech-date { font-weight: 400; opacity: 0.85; font-size: 10px; }
    .tech-none { color: #94A3B8; font-size: 12px; }
    .tech-multi { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; cursor: help; white-space: nowrap; }
    .tech-multi i { font-size: 11px; }
    .numero-code { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #2563EB; text-decoration: none; }

    /* Numéro d'intervention (remplace la colonne Statut) */
    .numero-code { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 12px; font-weight: 600; color: #475569; }

    /* Ligne verrouillée pour un technicien non assigné : info visible, détail inaccessible */
    .locked-row { cursor: default; }
    .locked-row:hover td { background-color: #FFFFFF !important; border-color: #E2E8F0 !important; }
    .locked-label { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #94A3B8; }
    .locked-label i { font-size: 11px; }

    /* Bandeau de retour utilisateur */
    .feedback-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      animation: feedback-in 0.25s ease;
    }
    .feedback-banner i { font-size: 14px; }
    .feedback-success { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .feedback-error { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }
    @keyframes feedback-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .btn-prendre { background: transparent; color: #2563EB; border: 1px solid #2563EB; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-prendre:hover { background: #2563EB; color: #FFFFFF; }

    .taken-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #2563EB; font-weight: 600; }
    .taken-label i { font-size: 12px; }

    .done-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #2563EB; font-weight: 600; }
    .done-label i { font-size: 12px; }

    .done-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
    .btn-rapport { background: transparent; color: #2563EB; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-rapport:hover { background: #EFF6FF; color: #2563EB; }

    .btn-terminer { background: transparent; color: #2563EB; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-terminer:hover { background: #EFF6FF; color: #2563EB; }

    @media (max-width: 1024px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .stat-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class MaintenancePageComponent {
  /** Bandeau de retour utilisateur après une action */
  feedbackMessage = signal('');
  feedbackType = signal<'success' | 'error'>('success');
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private maintenanceService: MaintenanceService,
    private equipmentService: EquipmentService,
    private usersService: UsersService,
    private settingsService: SettingsService,
    private authService: AuthService,
    private structureService: StructureService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Feedback provenant d'une redirection depuis la page Alertes ou du guard de permission.
    const params = this.route.snapshot.queryParamMap;
    if (params.get('taken') === '1') {
      this.showFeedback('Alerte prise en charge avec succès : elle apparaît maintenant ici.', 'success');
    } else if (params.get('planifie') === '1') {
      this.showFeedback('Intervention planifiée avec succès. Les techniciens affectés ont été notifiés.', 'success');
    } else if (params.get('affecte') === '1') {
      this.showFeedback('Alerte affectée avec succès. Les techniciens ont été notifiés.', 'success');
    } else if (params.get('denied') === '1') {
      this.showFeedback("Accès refusé : cette intervention est assignée à un autre technicien.", 'error');
    }
  }

  /** Nombre max de techniciens (défini dans /parametres). */
  get maxTechniciens(): number {
    return Math.max(1, this.settingsService.settings().maxTechniciens || 1);
  }

  /** Le bouton Planifier est visible pour l'admin si l'option est active. */
  get canPlanifier(): boolean {
    return this.isAdmin() && this.settingsService.settings().actionAdmin === 'planifier';
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

  get equipementsList(): { nom: string }[] {
    return this.equipmentService.getAll();
  }

  today(): string {
    const d = new Date();
    const p = (v: number) => v.toString().padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  structureLibelle(id?: string): string {
    if (!id) return '';
    return this.structureService.getStructure(id)?.nom || id;
  }

  // ===== Modale de planification =====
  showPlanifModal = false;
  planifEquipement = '';
  planifNature = '';
  planifDate = '';
  planifTechniciensIds: number[] = [];

  get canConfirmPlanif(): boolean {
    return !!this.planifEquipement && !!this.planifDate && this.planifTechniciensIds.length > 0;
  }

  ouvrirPlanification(): void {
    const eqs = this.equipementsList;
    this.planifEquipement = eqs.length ? eqs[0].nom : '';
    this.planifNature = 'Préventive';
    this.planifDate = '';
    this.planifTechniciensIds = [];
    this.showPlanifModal = true;
  }

  fermerPlanification(): void {
    this.showPlanifModal = false;
  }

  confirmerPlanification(): void {
    if (!this.canConfirmPlanif) return;
    const techniciens = this.techniciensDisponibles
      .filter(t => this.planifTechniciensIds.includes(t.id))
      .slice(0, this.maxTechniciens)
      .map(t => ({ id: t.id, nom: t.name }));

    this.maintenanceService.planifierNouvelleIntervention({
      equipment: this.planifEquipement,
      nature: this.planifNature,
      natures: [this.planifNature],
      date: this.planifDate,
      techniciens
    });
    this.fermerPlanification();
    this.showFeedback(
      `Intervention « ${this.planifNature} » sur ${this.planifEquipement} planifiée (${techniciens.length} techniciens affectés).`,
      'success'
    );
  }

  /**
   * Liste réactive lue directement depuis le signal du service :
   * elle se met à jour automatiquement après chaque action et lors des
   * synchronisations multi-onglets (autre technicien ayant pris une alerte).
   * Ne contient plus les alertes non prises (visibles uniquement sur /alerts).
   */
  get items(): MaintenanceItem[] {
    const sid = this.authService.getUser()?.structureId || null;
    // Chaque structure ne voit que SES interventions ; un technicien voit aussi
    // celles auxquelles il a été explicitement affecté. Le SuperAdmin voit tout.
    return this.maintenanceService.getItems().filter(i =>
      (i.prisPar || i.alertes === 0) &&
      (!sid || i.structureId === sid || i.affectes?.some(a => a.nom === this.getCurrentUserName()))
    );
  }

  getCurrentUserName(): string {
    return this.authService.getUser()?.name || 'Utilisateur';
  }

  /**
   * Afficher « Voir techniciens » dans la colonne Technicien :
   * dès qu'il y a plusieurs techniciens affectés (ou qu'un autre technicien
   * a déjà pris l'intervention), on préfère ouvrir la liste complète.
   */
  afficherVoirTechniciens(item: MaintenanceItem): boolean {
    if (!item.affectes || item.affectes.length === 0) return false;
    if (item.affectes.length > 1) return true;
    return !!item.prisPar && item.prisPar !== item.affectes[0].nom;
  }

  /** Nom du technicien principal d'une intervention (celui qui a pris, sinon le premier affecté). */
  technicienPrincipalNom(item: MaintenanceItem): string {
    if (item.prisPar) return item.prisPar;
    if (item.affectes && item.affectes.length > 0) return item.affectes[0].nom;
    return item.technicien || '';
  }

  /** Téléphone du technicien principal (recherché dans les comptes enregistrés). */
  telephoneTechnicienPrincipal(item: MaintenanceItem): string {
    const nom = this.technicienPrincipalNom(item);
    return nom ? this.telephoneTechnicien(nom) : '';
  }

  telephoneTechnicien(nom: string): string {
    const u = this.usersService.getAllUsers().find(x => x.name === nom);
    return u?.telephone ?? '';
  }

  /** Résumé « Nom — téléphone » des techniciens d'une intervention (pour l'infobulle). */
  techniciensAvecContacts(item: MaintenanceItem): string {
    const noms = new Set<string>();
    if (item.prisPar) noms.add(item.prisPar);
    item.affectes?.forEach(a => noms.add(a.nom));
    if (noms.size === 0 && item.technicien) noms.add(item.technicien);
    return Array.from(noms)
      .map(n => {
        const tel = this.telephoneTechnicien(n);
        return n + (tel ? ' — ' + tel : '');
      })
      .join('\n');
  }

  isAdmin(): boolean {
    return this.authService.isStructureAdmin() || this.authService.isSuperAdmin();
  }

  /**
   * Un technicien ne peut ouvrir le détail que d'une intervention non prise,
   * de celle qui lui est assignée (affectation multi), ou de celle qu'il a prise.
   * L'admin voit toujours tout.
   */
  peutOuvrirDetail(item: MaintenanceItem): boolean {
    if (this.isAdmin()) return true;
    const estAffecte = !!item.affectes?.some(a => a.nom === this.getCurrentUserName());
    return !item.prisPar || item.prisPar === this.getCurrentUserName() || estAffecte;
  }

  getEnCours(): number {
    return this.items.filter(i => i.statut === 'En cours').length;
  }

  getTerminees(): number {
    return this.items.filter(i => i.statut === 'Terminée').length;
  }

  getPlanifiees(): number {
    return this.items.filter(i => i.statut === 'Planifiée').length;
  }

  getEnCoursPourcent(): number {
    const total = this.items.length;
    return total === 0 ? 0 : Math.round((this.getEnCours() / total) * 100);
  }

  getTermineesPourcent(): number {
    const total = this.items.length;
    return total === 0 ? 0 : Math.round((this.getTerminees() / total) * 100);
  }

  getPlanifieesPourcent(): number {
    const total = this.items.length;
    return total === 0 ? 0 : Math.round((this.getPlanifiees() / total) * 100);
  }

  /** Génère le style conic-gradient pour un cercle de progression */
  getProgressStyle(percent: number, color: string): string {
    const p = Math.min(100, Math.max(0, percent));
    return `conic-gradient(${color} 0% ${p}%, #E2E8F0 ${p}% 100%)`;
  }

  /** Prendre une alerte immédiatement, sans validation admin préalable */
  prendreAlerte(item: MaintenanceItem): void {
    const success = this.maintenanceService.prendreAlerte(item.id, this.getCurrentUserName());
    if (success) {
      this.showFeedback(
        `Vous avez pris en charge l'alerte « ${item.type} » sur ${item.equipment}.`,
        'success'
      );
    } else {
      const latest = this.maintenanceService.getItems().find(i => i.id === item.id);
      this.showFeedback(
        `Impossible de prendre cette alerte : elle est déjà prise en charge par ${latest?.prisPar ?? 'un autre technicien'}.`,
        'error'
      );
    }
  }

  terminerMaintenance(item: MaintenanceItem): void {
    this.maintenanceService.terminerMaintenance(item.id);
    this.showFeedback(`Intervention sur ${item.equipment} marquée comme terminée.`, 'success');
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = setTimeout(() => this.feedbackMessage.set(''), 5000);
  }

  allerAuxRapports(): void {
    this.router.navigate(['/rapports']);
  }

  ouvrirDetail(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      const equipment = this.equipmentService.getOrCreateByName(item.equipment, {
        localisation: item.localisation,
        lienLocalisation: item.lienLocalisation
      });
      this.router.navigate(['/equipements', equipment.id], { queryParams: { source: 'maintenance' } });
    }
  }
}
