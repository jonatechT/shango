import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BasePageComponent } from '../base-page/base-page';
import { MaintenanceService, MaintenanceItem, RapportIntervention } from '../../services/maintenance.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-rapports-page',
  standalone: true,
  imports: [BasePageComponent, FormsModule],
  template: `
    <app-base-page title="Rapports" subtitle="Visualisation de tous les rapports d'intervention." icon="fa-solid fa-file-lines">
      <div page-actions>
        <button class="btn-rediger-top" (click)="ouvrirRapport()">
          <i class="fa-solid fa-pen"></i> Rédiger un rapport
        </button>
      </div>
      <div class="rapports-content">
        <!-- KPI Cards -->
        <div class="stat-grid">
          <div class="stat-card stat-card--green">
            <div class="stat-main">
              <span class="stat-label">Rapports rédigés</span>
              <span class="stat-value"><strong>{{ getRapportsCount() }}</strong></span>
            </div>
            <i class="fa-solid fa-file-lines stat-icon stat-icon--green"></i>
          </div>
          <div class="stat-card stat-card--blue">
            <div class="stat-main">
              <span class="stat-label">Interventions terminées</span>
              <span class="stat-value"><strong>{{ getTermineesCount() }}</strong></span>
            </div>
            <i class="fa-solid fa-circle-check stat-icon stat-icon--blue"></i>
          </div>
          <div class="stat-card stat-card--orange">
            <div class="stat-main">
              <span class="stat-label">Sans rapport</span>
              <span class="stat-value"><strong>{{ getSansRapportCount() }}</strong></span>
            </div>
            <i class="fa-solid fa-file-circle-exclamation stat-icon stat-icon--orange"></i>
          </div>
        </div>

        <!-- Liste des rapports -->
        <div class="table-card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Équipement</th>
                  <th>Type</th>
                  <th>Rédacteur</th>
                  <th>Date</th>
                  <th>Durée</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (item of rapports; track item.id) {
                  <tr>
                    <td>
                      <div class="equipment-cell">
                        <span class="equipment-name">{{ item.equipment }}</span>
                      </div>
                    </td>
                    <td>{{ item.type }}</td>
                    <td>{{ item.rapport?.redacteur || '—' }}</td>
                    <td>{{ item.rapport?.dateRedaction || '—' }}</td>
                    <td>{{ item.rapport?.dureeIntervention || '—' }}</td>
                    <td>
                      <div class="actions-cell">
                        @if (item.rapport) {
                          <button class="btn-voir" (click)="voirRapport(item)">
                            <i class="fa-solid fa-file-lines"></i> Voir
                          </button>
                          <button class="btn-export" (click)="exporterRapport(item)" title="Exporter le rapport">
                            <i class="fa-solid fa-download"></i> Exporter
                          </button>
                        } @else {
                          <span class="no-rapport">Aucun rapport</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </app-base-page>

    <!-- Modal rédaction rapport -->
    @if (showRapportModal) {
      <div class="rapport-overlay" (click)="fermerRapport()"></div>
      <div class="rapport-modal" role="dialog" aria-label="Rédiger un rapport d'intervention">
        <div class="rapport-modal-header">
          <div class="rapport-modal-icon">
            <i class="fa-solid fa-file-pen"></i>
          </div>
          <div class="rapport-modal-title-block">
            <h3 class="rapport-modal-title">Rapport d'intervention</h3>
          </div>
          <button class="rapport-modal-close" (click)="fermerRapport()" aria-label="Fermer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="rapport-modal-body">
          <div class="rapport-field">
            <label class="rapport-label">Intervention concernée <span class="rapport-required">*</span></label>
            <div class="rapport-dd" [class.rapport-dd--open]="rapportDropdownOpen" (keydown.escape)="rapportDropdownOpen = false">
              <button type="button" id="rapport-item" class="rapport-dd-trigger" (click)="$event.stopPropagation(); toggleRapportDropdown()" [attr.aria-expanded]="rapportDropdownOpen" aria-haspopup="listbox">
                @if (selectedIntervention; as sel) {
                  <span class="rapport-dd-selected">
                    <span class="rapport-dd-eq">{{ sel.equipment }}</span>
                  </span>
                } @else {
                  <span class="rapport-dd-placeholder">Sélectionnez une intervention terminée…</span>
                }
                <i class="fa-solid fa-chevron-down rapport-dd-chevron"></i>
              </button>
              @if (rapportDropdownOpen) {
                <div class="rapport-dd-panel" (click)="$event.stopPropagation()">
                  <div class="rapport-dd-list" role="listbox">
                    @for (item of rapports; track item.id) {
                      <button type="button" class="rapport-dd-option" [class.rapport-dd-option--selected]="item.id === selectedItemId" (click)="choisirIntervention(item)" role="option" [attr.aria-selected]="item.id === selectedItemId">
                        <span class="rapport-dd-option-eq">{{ item.equipment }}</span>
                      </button>
                    } @empty {
                      <div class="rapport-dd-empty">Aucune intervention disponible</div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="rapport-field">
            <label class="rapport-label" for="rapport-contenu">
              Description de l'intervention <span class="rapport-required">*</span>
            </label>
            <textarea
              id="rapport-contenu"
              class="rapport-textarea"
              [(ngModel)]="rapportForm.contenu"
              rows="5"
              placeholder="Décrivez les travaux effectués, les constats, les solutions apportées..."
              required
            ></textarea>
          </div>
          <div class="rapport-field">
            <label class="rapport-label" for="rapport-pieces">
              Pièces remplacées
            </label>
            <input
              id="rapport-pieces"
              class="rapport-input"
              [(ngModel)]="rapportForm.piecesRemplacees"
              placeholder="Ex : Batterie 12V, câble de charge..."
            />
          </div>
          <div class="rapport-field">
            <label class="rapport-label" for="rapport-duree">
              Durée de l'intervention
            </label>
            <input
              id="rapport-duree"
              class="rapport-input"
              [(ngModel)]="rapportForm.dureeIntervention"
              placeholder="Ex : 2h30"
            />
          </div>
        </div>

        <div class="rapport-modal-footer">
          <button class="rapport-btn-cancel" (click)="fermerRapport()">Annuler</button>
          <button class="rapport-btn-submit" (click)="enregistrerRapport()" [disabled]="rapportSubmitDisabled">
            <i class="fa-solid fa-check"></i> Enregistrer le rapport
          </button>
        </div>
      </div>
    }

    <!-- Modal consultation rapport -->
    @if (showRapportView && selectedItem?.rapport; as rapport) {
      <div class="rapport-overlay" (click)="fermerRapport()"></div>
      <div class="rapport-modal" role="dialog" aria-label="Rapport d'intervention">
        <div class="rapport-modal-header">
          <div class="rapport-modal-icon">
            <i class="fa-solid fa-file-lines"></i>
          </div>
          <div class="rapport-modal-title-block">
            <h3 class="rapport-modal-title">Rapport d'intervention</h3>
            <span class="rapport-modal-subtitle">{{ selectedItem?.equipment }} — {{ selectedItem?.type }}</span>
          </div>
          <button class="rapport-modal-close" (click)="fermerRapport()" aria-label="Fermer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="rapport-modal-body">
          <div class="rapport-view-meta">
            <span class="rapport-view-meta-item">
              <i class="fa-solid fa-user"></i> {{ rapport.redacteur }}
            </span>
            <span class="rapport-view-meta-item">
              <i class="fa-solid fa-calendar"></i> {{ rapport.dateRedaction }}
            </span>
            @if (rapport.dureeIntervention) {
              <span class="rapport-view-meta-item">
                <i class="fa-solid fa-clock"></i> {{ rapport.dureeIntervention }}
              </span>
            }
          </div>
          <div class="rapport-view-content">
            <p>{{ rapport.contenu }}</p>
            @if (rapport.typeRapport === 'conformite') {
              <div class="rapport-view-conformite">
                <strong>Résultat de la visite de conformité</strong>
                <span>Inspection réalisée : {{ rapport.inspectionRealisee === 'oui' ? 'Oui' : 'Non' }}</span>
                <span>Équipement conforme : {{ rapport.equipementConforme === 'oui' ? 'Oui' : (rapport.equipementConforme === 'non' ? 'Non' : 'N/A') }}</span>
                @if (rapport.commentaireInspection) {
                  <span>Commentaire : {{ rapport.commentaireInspection }}</span>
                }
              </div>
            }
            @if (rapport.piecesRemplacees) {
              <div class="rapport-view-pieces">
                <strong>Pièces remplacées :</strong>
                <span>{{ rapport.piecesRemplacees }}</span>
              </div>
            }
          </div>
        </div>

        <div class="rapport-modal-footer">
          <button class="rapport-btn-export" (click)="exporterRapport(selectedItem!)">
            <i class="fa-solid fa-download"></i> Exporter
          </button>
          <button class="rapport-btn-cancel" (click)="fermerRapport()">Fermer</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .rapports-content { display: flex; flex-direction: column; gap: 24px; width: 100%; }
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
    .stat-card--orange { background: #FFEDD5; border-color: rgba(234, 88, 12, 0.24); }
    .stat-icon--orange { color: #EA580C; }

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
    .data-table tbody td:nth-child(3),
    .data-table tbody td:nth-child(4),
    .data-table tbody td:nth-child(5) {
      color: #64748B;
      font-size: 12px;
    }
    .data-table tbody td:last-child { text-align: right; }

    .equipment-cell { display: flex; align-items: center; gap: 10px; }
    .equipment-name { font-weight: 600; color: #0F172A; font-size: 13px; }

    .btn-voir { background: transparent; color: #2563EB; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-voir:hover { background: #EFF6FF; color: #2563EB; }

    .no-rapport { font-size: 12px; color: #94A3B8; font-style: italic; }

    .rapports-actions { display: flex; align-items: center; gap: 12px; }
    .btn-rediger-top { background: #2563EB; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35); position: relative; top: 8px; }
    .btn-rediger-top:hover { background: #1D4ED8; transform: translateY(-1px); }
    .btn-rediger-top:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .rapports-actions-hint { font-size: 12px; color: #94A3B8; font-style: italic; }

    .actions-cell { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn-export { background: transparent; color: #10B981; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-export:hover { background: #ECFDF5; color: #059669; }

    .rapport-select { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; outline: none; background: rgba(255, 255, 255, 0.35); cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .rapport-select:focus { border-color: #2563EB; background: rgba(255, 255, 255, 0.55); }

    /* Modal rédaction */
    .rapport-field { display: flex; flex-direction: column; gap: 6px; }
    .rapport-view-conformite { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #F0FDF4; border-radius: 10px; border: 1px solid #A7F3D0; }
    .rapport-view-conformite strong { font-size: 12px; color: #047857; }
    .rapport-view-conformite span { font-size: 13px; color: #334155; }
    .rapport-label { font-size: 12px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 6px; }
    .rapport-label i { color: #1E3A8A; font-size: 12px; }
    .rapport-required { color: #EF4444; font-weight: 700; }
    .rapport-select { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; outline: none; background: #FFFFFF; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .rapport-select:focus { border-color: #2563EB; background: #FFFFFF; }
    .rapport-textarea { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; resize: vertical; min-height: 100px; outline: none; transition: all 0.2s ease; background: #FFFFFF; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .rapport-textarea:focus { border-color: #2563EB; background: #FFFFFF; }
    .rapport-input { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; outline: none; transition: all 0.2s ease; background: #FFFFFF; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .rapport-input:focus { border-color: #2563EB; background: #FFFFFF; }
    .rapport-btn-submit { background: #2563EB; color: #FFF; border: none; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .rapport-btn-submit:hover { background: #1D4ED8; transform: translateY(-1px); }
    .rapport-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .rapport-btn-export { background: #10B981; color: #FFF; border: none; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; margin-right: auto; }
    .rapport-btn-export:hover { background: #059669; }

    /* Modal rapport */
    .rapport-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.35); z-index: 1500; backdrop-filter: blur(8px) saturate(1.2); -webkit-backdrop-filter: blur(8px) saturate(1.2); }
    .rapport-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 680px; max-width: 92vw; max-height: 90vh; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; z-index: 1501; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.12), 0 24px 64px rgba(15, 23, 42, 0.2); display: flex; flex-direction: column; overflow: hidden; animation: rapportSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes rapportSlideIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
    .rapport-modal-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; border-bottom: 1px solid #1E40AF; background: linear-gradient(180deg, #2563EB, #1D4ED8); }
    .rapport-modal-icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, 0.18); color: #FFF; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.25); }
    .rapport-modal-title-block { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .rapport-modal-title { font-size: 16px; font-weight: 700; color: #FFF; margin: 0; letter-spacing: -0.2px; }
    .rapport-modal-subtitle { font-size: 11px; color: rgba(255, 255, 255, 0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rapport-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255, 255, 255, 0.12); color: #FFF; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; }
    .rapport-modal-close:hover { background: rgba(255, 255, 255, 0.22); }
    .rapport-modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
    .rapport-view-meta { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; background: #F8FAFC; border-radius: 10px; border: 1px solid #E2E8F0; }
    .rapport-view-meta-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748B; }
    .rapport-view-meta-item i { color: #1E3A8A; }
    .rapport-view-content { display: flex; flex-direction: column; gap: 12px; }
    .rapport-view-content p { font-size: 13px; color: #334155; line-height: 1.6; margin: 0; }
    .rapport-view-pieces { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #EFF6FF; border-radius: 10px; border: 1px solid #BFDBFE; }
    .rapport-view-pieces strong { font-size: 12px; color: #1E3A8A; }
    .rapport-view-pieces span { font-size: 13px; color: #334155; }
    .rapport-modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #E2E8F0; }
    .rapport-btn-cancel { background: #F1F5F9; color: #334155; border: 1px solid #E2E8F0; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .rapport-btn-cancel:hover { background: #E2E8F0; }

    /* Dropdown personnalisé — sélection d'intervention */
    .rapport-dd { position: relative; }
    .rapport-dd-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; outline: none; background: #FFFFFF; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); text-align: left; }
    .rapport-dd-trigger:hover { border-color: #CBD5E1; }
    .rapport-dd--open .rapport-dd-trigger { border-color: #2563EB; background: #FFFFFF; }
    .rapport-dd-placeholder { color: #94A3B8; }
    .rapport-dd-selected { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .rapport-dd-eq { font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rapport-dd-chevron { color: #64748B; font-size: 12px; flex-shrink: 0; transition: transform 0.2s ease; }
    .rapport-dd--open .rapport-dd-chevron { transform: rotate(180deg); color: #2563EB; }
    .rapport-dd-panel { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1), 0 12px 32px rgba(15, 23, 42, 0.18); overflow: hidden; display: flex; flex-direction: column; animation: rapportDdIn 0.15s ease; }
    @keyframes rapportDdIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .rapport-dd-list { max-height: 220px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
    .rapport-dd-option { display: flex; align-items: center; width: 100%; border: none; background: transparent; border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; font-family: inherit; transition: background 0.15s ease; }
    .rapport-dd-option:hover { background: rgba(37, 99, 235, 0.08); }
    .rapport-dd-option--selected { background: rgba(37, 99, 235, 0.12); }
    .rapport-dd-option-eq { font-size: 13px; font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rapport-dd-empty { padding: 18px 12px; text-align: center; font-size: 12px; color: #94A3B8; font-style: italic; }

    @media (max-width: 1024px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .stat-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class RapportsPageComponent implements OnInit {
  rapports: MaintenanceItem[] = [];
  selectedItem: MaintenanceItem | null = null;
  selectedItemId: string | null = null;
  showRapportModal = false;
  showRapportView = false;
  rapportDropdownOpen = false;
  rapportForm: {
    contenu: string;
    piecesRemplacees?: string;
    dureeIntervention?: string;
  } = {
    contenu: '',
    piecesRemplacees: '',
    dureeIntervention: ''
  };

  constructor(
    private maintenanceService: MaintenanceService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.rapports = this.maintenanceService.getItems().filter(i => i.statut === 'Terminée');
  }

  getRapportsCount(): number {
    return this.rapports.filter(i => i.rapport).length;
  }

  getTermineesCount(): number {
    return this.rapports.length;
  }

  getSansRapportCount(): number {
    return this.rapports.filter(i => !i.rapport).length;
  }

  getRapportsPourcent(): number {
    const total = this.getTermineesCount();
    return total === 0 ? 0 : Math.round((this.getRapportsCount() / total) * 100);
  }

  getTermineesPourcent(): number {
    return 100;
  }

  /** Bouton d'envoi : désactivé tant que les champs obligatoires ne sont pas renseignés */
  get rapportSubmitDisabled(): boolean {
    if (!this.selectedItemId) return true;
    return !this.rapportForm.contenu.trim();
  }

  /** Intervention actuellement sélectionnée dans le dropdown */
  get selectedIntervention(): MaintenanceItem | null {
    return this.rapports.find(i => i.id === this.selectedItemId) || null;
  }

  /** Ferme le dropdown au clic en dehors */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.rapportDropdownOpen = false;
  }

  toggleRapportDropdown(): void {
    this.rapportDropdownOpen = !this.rapportDropdownOpen;
  }

  /** Sélectionne une intervention dans le dropdown */
  choisirIntervention(item: MaintenanceItem): void {
    this.selectedItemId = item.id;
    this.rapportDropdownOpen = false;
    this.surSelectionIntervention();
  }

  getSansRapportPourcent(): number {
    const total = this.getTermineesCount();
    return total === 0 ? 0 : Math.round((this.getSansRapportCount() / total) * 100);
  }

  /** Génère le style conic-gradient pour un cercle de progression */
  getProgressStyle(percent: number, color: string): string {
    const p = Math.min(100, Math.max(0, percent));
    return `conic-gradient(${color} 0% ${p}%, #E2E8F0 ${p}% 100%)`;
  }

  ouvrirRapport(item?: MaintenanceItem): void {
    this.selectedItem = item || null;
    this.selectedItemId = item?.id || null;
    this.rapportDropdownOpen = false;
    this.rapportForm = {
      contenu: item?.rapport?.contenu || '',
      piecesRemplacees: item?.rapport?.piecesRemplacees || '',
      dureeIntervention: item?.rapport?.dureeIntervention || ''
    };
    this.showRapportModal = true;
    this.showRapportView = false;
  }

  /** Pré-remplit le formulaire avec le rapport existant lors de la sélection */
  surSelectionIntervention(): void {
    const item = this.rapports.find(i => i.id === this.selectedItemId);
    if (item?.rapport) {
      this.rapportForm = {
        contenu: item.rapport.contenu,
        piecesRemplacees: item.rapport.piecesRemplacees || '',
        dureeIntervention: item.rapport.dureeIntervention || ''
      };
    } else {
      this.rapportForm = {
        contenu: '',
        piecesRemplacees: '',
        dureeIntervention: ''
      };
    }
  }

  voirRapport(item: MaintenanceItem): void {
    this.selectedItem = item;
    this.showRapportModal = false;
    this.showRapportView = true;
  }

  fermerRapport(): void {
    this.showRapportModal = false;
    this.showRapportView = false;
    this.selectedItem = null;
    this.rapportDropdownOpen = false;
  }

  enregistrerRapport(): void {
    if (!this.selectedItemId || this.rapportSubmitDisabled) return;
    const rapport: RapportIntervention = {
      contenu: this.rapportForm.contenu.trim(),
      typeRapport: 'intervention' as const,
      piecesRemplacees: this.rapportForm.piecesRemplacees?.trim() || undefined,
      dureeIntervention: this.rapportForm.dureeIntervention?.trim() || undefined,
      dateRedaction: new Date().toLocaleDateString('fr-FR'),
      redacteur: this.authService.getUser()?.name || 'Technicien'
    };
    this.maintenanceService.redigerRapport(this.selectedItemId, rapport);
    this.rapports = this.maintenanceService.getItems().filter(i => i.statut === 'Terminée');
    this.fermerRapport();
  }

/**
   * Charge le logo Shango (public/logo.jpg) et le convertit en data URL,
   * seul format que jsPDF sait intégrer dans un PDF via `addImage`.
   * Retourne null si le logo est introuvable (le PDF est alors généré sans).
   */
  private async chargerLogoBase64(): Promise<string | null> {
    try {
      const res = await fetch('logo.jpg');
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  /**
   * Exporte le rapport en PDF (mise en page professionnelle : bandeau
   * d'en-tête, fiche d'informations en tableau, section conformité le cas
   * échéant, pièces remplacées, pied de page) plutôt qu'un simple fichier
   * texte brut.
   */
  async exporterRapport(item: MaintenanceItem): Promise<void> {
    if (!item?.rapport || typeof window === 'undefined') return;
    const r = item.rapport;

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const logoDataUrl = await this.chargerLogoBase64();

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const estConformite = r.typeRapport === 'conformite';

      // ===== Bandeau d'en-tête =====
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 30, 'F');
      const logoSize = 12;
      const texteX = logoDataUrl ? margin + logoSize + 4 : margin;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'JPEG', margin, 9, logoSize, logoSize);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(estConformite ? 'RAPPORT DE CONFORMITÉ' : "RAPPORT D'INTERVENTION", texteX, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('SHANGO — plateforme de suivi et de télémaintenance des équipements', texteX, 18);
      doc.setFontSize(9);
      doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, 18, { align: 'right' });
      doc.setTextColor(20, 30, 50);

      // ===== Fiche d'informations =====
      const infoBody: string[][] = [
        ['Équipement', item.equipment],
        ["Type d'intervention", item.type],
        ['Date prévue', item.datePrevue],
        ['Technicien assigné', item.technicien || '—'],
        ['Rédigé par', r.redacteur],
        ['Date de rédaction', r.dateRedaction]
      ];
      if (r.dureeIntervention) infoBody.push(["Durée de l'intervention", r.dureeIntervention]);

      autoTable(doc, {
        startY: 36,
        head: [['Élément', 'Valeur']],
        body: infoBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
      });

      let y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36;

      // ===== Section conformité (le cas échéant) =====
      if (estConformite) {
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(4, 120, 87);
        doc.text('Conformité', margin, y);
        doc.setTextColor(20, 30, 50);
        y += 4;
        autoTable(doc, {
          startY: y,
          body: [
            ['Inspection réalisée', r.inspectionRealisee === 'oui' ? 'Oui' : 'Non'],
            ['Équipement conforme', r.equipementConforme === 'oui' ? 'Oui' : r.equipementConforme === 'non' ? 'Non' : 'N/A']
          ],
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
        });
        y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
        if (r.commentaireInspection) {
          y += 8;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text("Commentaire d'inspection", margin, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(r.commentaireInspection, contentWidth);
          doc.text(lines, margin, y);
          y += lines.length * 5;
        }
      }

      // ===== Description de l'intervention =====
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("Description de l'intervention", margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const descLines = doc.splitTextToSize(r.contenu, contentWidth);
      doc.text(descLines, margin, y);
      y += descLines.length * 5;
      doc.setTextColor(20, 30, 50);

      // ===== Pièces remplacées =====
      if (r.piecesRemplacees) {
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Pièces remplacées', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const piecesLines = doc.splitTextToSize(r.piecesRemplacees, contentWidth);
        doc.text(piecesLines, margin, y);
        doc.setTextColor(20, 30, 50);
      }

      // ===== Pied de page =====
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(130, 140, 160);
        doc.text('Document généré automatiquement par Shango — Rapport d\'intervention.', margin, pageHeight - 10);
        doc.text(`Page ${p} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      doc.save(`rapport-${item.equipment.replace(/[^a-zA-Z0-9]/g, '-')}-${r.dateRedaction.replace(/\//g, '-')}.pdf`);
    } catch (e) {
      console.error('Erreur lors de l\'export du rapport', e);
    }
  }
}
