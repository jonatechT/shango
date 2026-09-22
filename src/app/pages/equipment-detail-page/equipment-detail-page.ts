import { DatePipe } from '@angular/common';
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import {
  EquipmentService,
  Equipment,
  EquipmentDiagnostic,
  BatteryCurrentDiagnostic,
  BatteryHistoryEntry,
  LocationHistoryEntry,
  TelemetrieEntry
} from '../../services/equipment.service';
import { MaintenanceItem, MaintenanceService } from '../../services/maintenance.service';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../auth/auth.service';
import { BatteryHistoryChartsComponent } from '../../components/battery-history-charts/battery-history-charts';

@Component({
  selector: 'app-equipment-detail-page',
  standalone: true,
  imports: [BatteryHistoryChartsComponent, DatePipe],
  template: `
    <div class="eqd-shell">
      <!-- ===== Notification flottante : connexion/déconnexion du boîtier ===== -->
      @if (espConnectionToast(); as toast) {
        <div
          class="eqd-esp-toast"
          [class.eqd-esp-toast--connected]="toast.connected"
          [class.eqd-esp-toast--disconnected]="!toast.connected"
          role="status"
        >
          <i class="fa-solid" [class.fa-wifi]="toast.connected" [class.fa-plug-circle-xmark]="!toast.connected"></i>
          <span>{{ toast.message }}</span>
        </div>
      }

      <!-- ===== Header premium ===== -->
      <header class="eqd-header">
        <div class="eqd-header-text">
          <h1 class="eqd-title">Détail de l'équipement</h1>
          <p class="eqd-subtitle">Informations techniques et diagnostic en temps réel.</p>
        </div>
        <div class="eqd-header-actions">
          @if (equipment) {
            <button
              type="button"
              class="eqd-btn"
              [class.eqd-btn-danger]="!isBloque()"
              [class.eqd-btn-success]="isBloque()"
              (click)="demanderChangementStatut()"
              [disabled]="statusActionBusy()"
            >
              <i class="fa-solid" [class.fa-lock]="!isBloque()" [class.fa-lock-open]="isBloque()"></i>
              <span>{{ isBloque() ? "Débloquer l'équipement" : "Bloquer l'équipement" }}</span>
            </button>
          }
          <button type="button" class="eqd-btn eqd-btn-ghost" (click)="retour()">
            <i class="fa-solid fa-arrow-left"></i>
            <span>{{ backButtonText }}</span>
          </button>
        </div>
      </header>

      @if (statusMessage()) {
        <div
          class="eqd-alert"
          [class.eqd-alert--success]="statusMessageType() === 'success'"
          [class.eqd-alert--error]="statusMessageType() === 'error'"
          role="status"
        >
          <i
            class="fa-solid"
            [class.fa-circle-check]="statusMessageType() === 'success'"
            [class.fa-circle-xmark]="statusMessageType() === 'error'"
          ></i>
          <span>{{ statusMessage() }}</span>
        </div>
      }

      @if (!equipment) {
        <!-- ===== État vide ===== -->
        <section class="eqd-empty">
          <span class="eqd-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
          <p class="eqd-empty-text">Équipement introuvable.</p>
          <button type="button" class="eqd-btn eqd-btn-ghost" (click)="retour()">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Retour</span>
          </button>
        </section>
      } @else {
        <!-- ===== Intervention & affectations (visible uniquement depuis /maintenance) ===== -->
        @if (source === 'maintenance') {
          <section class="eqd-interv">
            <header class="eqd-bdiag-head">
              <span class="eqd-chip eqd-chip-blue eqd-chip-lg"><i class="fa-solid fa-user-gear"></i></span>
              <div class="eqd-bdiag-head-text">
                <h3 class="eqd-bdiag-title">Intervention de maintenance</h3>
                <p class="eqd-bdiag-sub">Techniciens affectés et planification liés à cet équipement.</p>
              </div>
            </header>

            <div class="eqd-interv-block">
              <h4 class="eqd-interv-block-title">
                <i class="fa-solid fa-users-gear"></i>
                <span>Techniciens affectés</span>
              </h4>
              @if (techniciensAffectes.length > 0) {
                <ul class="eqd-interv-tech-list">
                  @for (tech of techniciensAffectes; track $index) {
                    <li class="eqd-interv-tech-item">
                      <span class="eqd-interv-tech-avatar"><i class="fa-solid fa-user"></i></span>
                      <span class="eqd-interv-tech-name">{{ tech.nom }}</span>
                      @if (tech.telephone) {
                        <a class="eqd-interv-tech-tel" [href]="'tel:' + tech.telephone">
                          <i class="fa-solid fa-phone"></i> {{ tech.telephone }}
                        </a>
                      } @else {
                        <span class="eqd-interv-tech-tel eqd-interv-tech-tel--muted">
                          <i class="fa-solid fa-phone-slash"></i> N° non renseigné
                        </span>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="eqd-interv-empty">
                  <i class="fa-solid fa-circle-info"></i>
                  Aucun technicien n'a été affecté à cet équipement.
                </p>
              }
            </div>

            <div class="eqd-interv-block">
              <h4 class="eqd-interv-block-title">
                <i class="fa-solid fa-calendar-days"></i>
                <span>Planification d'intervention</span>
              </h4>
              @if (maintenanceItem) {
                <div class="eqd-interv-plan-card">
                  <div class="eqd-interv-plan-row">
                    <span class="eqd-interv-plan-key">Objet</span>
                    <span class="eqd-interv-plan-val">{{ maintenanceItem.type }}</span>
                  </div>
                  <div class="eqd-interv-plan-row">
                    <span class="eqd-interv-plan-key">Statut</span>
                    <span class="eqd-interv-plan-badge">{{ maintenanceItem.statut }}</span>
                  </div>
                  @if (maintenanceItem.natures?.length) {
                    <div class="eqd-interv-plan-row">
                      <span class="eqd-interv-plan-key">Natures</span>
                      <span class="eqd-interv-plan-val">
                        @for (n of maintenanceItem.natures; track $index) {
                          <span class="eqd-interv-plan-tag">{{ n }}</span>
                        }
                      </span>
                    </div>
                  }
                  @if (maintenanceItem.datePrevueISO || maintenanceItem.datePrevue) {
                    <div class="eqd-interv-plan-row">
                      <span class="eqd-interv-plan-key">Date prévue</span>
                      <span class="eqd-interv-plan-val">
                        <i class="fa-regular fa-clock"></i>
                        {{ datePrevueDisplay }}
                      </span>
                    </div>
                  }
                  @if (maintenanceItem.dateAffectation) {
                    <div class="eqd-interv-plan-row">
                      <span class="eqd-interv-plan-key">Affecté le</span>
                      <span class="eqd-interv-plan-val">
                        <i class="fa-solid fa-calendar-days"></i>
                        {{ maintenanceItem.dateAffectation }}
                      </span>
                    </div>
                  }
                  @if (maintenanceItem.delaiAffectation) {
                    <div class="eqd-interv-plan-row">
                      <span class="eqd-interv-plan-key">Délai</span>
                      <span class="eqd-interv-plan-val">
                        <i class="fa-regular fa-hourglass"></i>
                        {{ maintenanceItem.delaiAffectation }}
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <p class="eqd-interv-empty">
                  <i class="fa-solid fa-circle-info"></i>
                  Aucune planification d'intervention n'est prévue sur cet équipement.
                </p>
              }
            </div>
          </section>
        }
        <!-- ===== Carte résumé de l'équipement ===== -->
        <section class="eqd-summary">
          <div class="eqd-summary-main">
            @if (equipment.photoDataUrl) {
              <img class="eqd-summary-photo" [src]="equipment.photoDataUrl" alt="Photo de l'équipement" />
            } @else {
              <span class="eqd-summary-icon"><i class="fa-solid fa-cube"></i></span>
            }
            <div class="eqd-summary-info">
              <h2 class="eqd-summary-name">{{ equipment.nom }}</h2>
              <div class="eqd-summary-id">
                <span class="eqd-id-chip">ID</span>
                <span class="eqd-id-value">{{ equipment.id }}</span>
              </div>
            </div>
          </div>
          <div class="eqd-summary-side">
            <span [class]="'eqd-state-chip ' + unifiedStatusClass">
              {{ unifiedStatusLabel }}
            </span>
            <span class="eqd-summary-sync">
              <i class="fa-regular fa-clock"></i>
              Dernière synchro : {{ equipment.miseEnLigne }}
            </span>
          </div>
        </section>

        <!-- ===== Grille des indicateurs ===== -->
        <!-- Ordre voulu : Latitude+Longitude (complémentaires, même ligne),
             DoD+État du kit (même ligne), puis Courant en dernier — la grille
             est en 2 colonnes fixes (.eqd-grid), donc deux cartes consécutives
             dans le code tombent automatiquement sur la même ligne. -->
        <section class="eqd-grid">
          <!-- Latitude -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-purple"><i class="fa-solid fa-location-dot"></i></span>
              <span class="eqd-card-label">Latitude</span>
            </div>
            @if (hasGpsFix()) {
              <div class="eqd-card-value eqd-coords">{{ telemetrieLatitudeDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">En attente d'un fix GPS du boîtier</span>
              </div>
            }
          </article>

          <!-- Longitude -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-purple"><i class="fa-solid fa-location-dot"></i></span>
              <span class="eqd-card-label">Longitude</span>
            </div>
            @if (hasGpsFix()) {
              <div class="eqd-card-value eqd-coords">{{ telemetrieLongitudeDisplay }}</div>
              <a
                class="eqd-maps-btn"
                [href]="telemetrieMapsLink"
                target="_blank"
                rel="noopener"
              >
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Voir sur Google Maps</span>
              </a>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">En attente d'un fix GPS du boîtier</span>
              </div>
            }
          </article>

          <!-- Profondeur de décharge (DoD) -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-amber"><i class="fa-solid fa-arrow-trend-down"></i></span>
              <span class="eqd-card-label">DoD (décharge)</span>
            </div>
            @if (batteryDiagnostic()?.dod_percent !== null && batteryDiagnostic()?.dod_percent !== undefined) {
              <div class="eqd-card-value">{{ batteryDodDisplay }}</div>
              <div class="eqd-card-meta">Dernier diagnostic batterie</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Lancer un diagnostic pour mesurer</span>
              </div>
            }
          </article>

          <!-- État du kit -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-amber"><i class="fa-solid fa-power-off"></i></span>
              <span class="eqd-card-label">État du kit</span>
            </div>
            @if (latestTelemetrie()?.etat_kit) {
              <div [class]="'eqd-card-value ' + etatKitStatusClass">{{ telemetrieEtatKitDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Lancer un diagnostic pour mesurer</span>
              </div>
            }
          </article>

          <!-- Température -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-cyan"><i class="fa-solid fa-temperature-half"></i></span>
              <span class="eqd-card-label">Température</span>
            </div>
            @if (latestTelemetrie()?.temperature !== null && latestTelemetrie()?.temperature !== undefined) {
              <div class="eqd-card-value">{{ telemetrieTemperatureDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Aucune télémétrie reçue</span>
              </div>
            }
          </article>

          <!-- Tension -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-green"><i class="fa-solid fa-bolt"></i></span>
              <span class="eqd-card-label">Tension</span>
            </div>
            @if (latestTelemetrie()?.tension !== null && latestTelemetrie()?.tension !== undefined) {
              <div class="eqd-card-value">{{ telemetrieTensionDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Aucune télémétrie reçue</span>
              </div>
            }
          </article>

          <!-- Humidité -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-orange"><i class="fa-solid fa-droplet"></i></span>
              <span class="eqd-card-label">Humidité</span>
            </div>
            @if (latestTelemetrie()?.humidite !== null && latestTelemetrie()?.humidite !== undefined) {
              <div class="eqd-card-value">{{ telemetrieHumiditeDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Aucune télémétrie reçue</span>
              </div>
            }
          </article>

          <!-- Courant -->
          <article class="eqd-card">
            <div class="eqd-card-head">
              <span class="eqd-chip eqd-chip-blue"><i class="fa-solid fa-microchip"></i></span>
              <span class="eqd-card-label">Courant</span>
            </div>
            @if (latestTelemetrie()?.courant !== null && latestTelemetrie()?.courant !== undefined) {
              <div class="eqd-card-value">{{ telemetrieCourantDisplay }}</div>
              <div class="eqd-card-meta">Dernière télémétrie IoT reçue</div>
            } @else {
              <div class="eqd-card-value eqd-value-empty">—</div>
              <div class="eqd-card-foot">
                <span class="eqd-badge eqd-badge-neutral">Donnée non disponible</span>
                <span class="eqd-card-meta">Aucune télémétrie reçue</span>
              </div>
            }
          </article>
        </section>

        <!-- ===== Carte diagnostic batterie ===== -->
        <section class="eqd-battery-diag">
          <header class="eqd-bdiag-head">
            <span class="eqd-chip eqd-chip-purple eqd-chip-lg"><i class="fa-solid fa-battery-full"></i></span>
            <div class="eqd-bdiag-head-text">
              <h3 class="eqd-bdiag-title">SOH et RUL</h3>
              <p class="eqd-bdiag-sub">State of Health and Remaining Useful Life</p>
            </div>
            <div class="eqd-bdiag-head-actions">
              @if (batteryDiagnostic()) {
                <span [class]="'eqd-badge eqd-badge-lg ' + batteryStateBadgeClass">
                  {{ batteryEtatDisplay }}
                </span>
              }
              <button
                type="button"
                class="eqd-btn eqd-bdiag-launch"
                [class.eqd-btn-primary]="!batteryLoading()"
                [class.eqd-btn-danger]="batteryLoading()"
                (click)="basculerDiagnostic()"
              >
                @if (batteryLoading()) {
                  <i class="fa-solid fa-stop"></i>
                  <span>Arrêter</span>
                } @else {
                  <i class="fa-solid fa-stethoscope"></i>
                  <span>Lancer un diagnostic</span>
                }
              </button>
            </div>
          </header>

          @if (batteryLoading()) {
            <!-- ===== Chargement ===== -->
            <div class="eqd-bdiag-unavailable">
              <span class="eqd-bdiag-unavail-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>
              <h4 class="eqd-bdiag-unavail-title">Diagnostic en cours…</h4>
              <p class="eqd-bdiag-unavail-text">
                Analyse de la batterie en cours. Vous pouvez arrêter le diagnostic à tout moment.
              </p>
            </div>
          } @else if (!batteryDiagnostic()) {
            <!-- ===== Diagnostic indisponible / backend indisponible ===== -->
            <div class="eqd-bdiag-unavailable">
              <span class="eqd-bdiag-unavail-icon"><i class="fa-solid fa-circle-info"></i></span>
              <h4 class="eqd-bdiag-unavail-title">{{ batteryUnavailableTitle }}</h4>
              <p class="eqd-bdiag-unavail-text">{{ batteryUnavailableMessage }}</p>
            </div>
          } @else {
            <!-- ===== Grille état / SOH ===== -->
            <div class="eqd-bdiag-grid">
              <div class="eqd-bdiag-stat-card">
                <span class="eqd-bdiag-stat-key">ÉTAT</span>
                <div class="eqd-bdiag-stat-value">
                  <span class="eqd-bdiag-state-icon" [class]="batteryStateIconClass">
                    <i [class]="batteryStateIcon"></i>
                  </span>
                  <span>{{ batteryEtatDisplay }}</span>
                </div>
                <span class="eqd-bdiag-state-hint">{{ batteryStateHint }}</span>
              </div>
              <div class="eqd-bdiag-stat-card">
                <span class="eqd-bdiag-stat-key">SOH — État de santé</span>
                <div class="eqd-bdiag-stat-value">
                  <span [class]="'eqd-bdiag-state-icon ' + batteryStateIconClass">
                    <i class="fa-solid fa-heart-pulse"></i>
                  </span>
                  @if (batteryDiagnostic()?.soh_pourcent !== null && batteryDiagnostic()?.soh_pourcent !== undefined) {
                    <span>{{ batteryDiagnostic()?.soh_pourcent }} %</span>
                  } @else {
                    <span>—</span>
                  }
                </div>
                <span class="eqd-bdiag-state-hint">{{ batterySohHint }}</span>
              </div>
            </div>
<!-- ===== Mesures capteurs ===== -->
            <div class="eqd-bdiag-measures">
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--blue"><i class="fa-solid fa-bolt"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Tension du pack</span>
                  <span class="eqd-bdiag-measure-value">{{ batteryVoltageDisplay }}</span>
                </div>
              </div>
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--green"><i class="fa-solid fa-microchip"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Courant</span>
                  <span class="eqd-bdiag-measure-value">{{ batteryCurrentDisplay }}</span>
                </div>
              </div>
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--orange"><i class="fa-solid fa-temperature-half"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Température</span>
                  <span class="eqd-bdiag-measure-value">{{ batteryTemperatureDisplay }}</span>
                </div>
              </div>
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--red"><i class="fa-solid fa-arrow-trend-down"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Profondeur de décharge (DoD)</span>
                  <span class="eqd-bdiag-measure-value">{{ batteryDodDisplay }}</span>
                </div>
              </div>
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--cyan"><i class="fa-solid fa-droplet"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Humidité</span>
                  <span class="eqd-bdiag-measure-value">{{ batteryHumidityDisplay }}</span>
                </div>
              </div>
              <div class="eqd-bdiag-measure">
                <span class="eqd-bdiag-measure-icon eqd-bdiag-measure-icon--purple"><i class="fa-solid fa-file-invoice-dollar"></i></span>
                <div class="eqd-bdiag-measure-text">
                  <span class="eqd-bdiag-measure-key">Statut paiement</span>
                  <span [class]="'eqd-bdiag-measure-value ' + paiementStatusClass">{{ batteryPaiementDisplay }}</span>
                </div>
              </div>
            </div>

            <!-- ===== Capacité + durée de vie ===== -->
            <div class="eqd-bdiag-duration-row">
              <div class="eqd-bdiag-duration">
                <span class="eqd-bdiag-dur-key">Durée de vie estimée</span>
                <div class="eqd-bdiag-dur-main">
                  <span class="eqd-bdiag-dur-value">{{ batteryDurationDisplay }}</span>
                  <span class="eqd-bdiag-dur-range">Estimation fournie par le backend</span>
                </div>
              </div>
              <div class="eqd-bdiag-duration">
                <span class="eqd-bdiag-dur-key">Capacité restante</span>
                <div class="eqd-bdiag-dur-main">
                  <span class="eqd-bdiag-dur-value">{{ batteryCapacityDisplay }}</span>
                  <span class="eqd-bdiag-dur-range">Dernière analyse : {{ batteryDateDisplay }}</span>
                </div>
              </div>
            </div>

            <!-- ===== Message de maintenance ===== -->
            <div [class]="'eqd-bdiag-message ' + batteryMessageClass">
              <span class="eqd-bdiag-msg-icon"><i [class]="batteryMessageIcon"></i></span>
              <span class="eqd-bdiag-msg-text">{{ batteryMessageDisplay }}</span>
            </div>
          }

        </section>
<!-- ===== Historique de la batterie ===== -->
        <section class="eqd-battery-history">
          <header class="eqd-bdiag-head">
            <span class="eqd-chip eqd-chip-blue eqd-chip-lg"><i class="fa-solid fa-chart-line"></i></span>
            <div class="eqd-bdiag-head-text">
              <h3 class="eqd-bdiag-title">Historique de la batterie</h3>
              <p class="eqd-bdiag-sub">Évolution du SOH (état de santé de la batterie).</p>
            </div>
          </header>

          @if (batteryHistoryLoading()) {
            <div class="eqd-bdiag-unavailable">
              <span class="eqd-bdiag-unavail-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>
              <h4 class="eqd-bdiag-unavail-title">Chargement de l'historique…</h4>
              <p class="eqd-bdiag-unavail-text">Récupération des données d'historique en cours.</p>
            </div>
          } @else if (batteryHistory().length === 0) {
            <div class="eqd-bdiag-unavailable">
              <span class="eqd-bdiag-unavail-icon"><i class="fa-solid fa-clock-rotate-left"></i></span>
              <h4 class="eqd-bdiag-unavail-title">Historique indisponible</h4>
              <p class="eqd-bdiag-unavail-text">
                Aucune donnée d'historique n'est disponible pour cet équipement.
              </p>
            </div>
          } @else {
            <app-battery-history-charts [history]="batteryHistory()" />
          }
        </section>

        <!-- ===== Historique de localisation ===== -->
        <section class="eqd-loc-history">
          <header class="eqd-bdiag-head">
            <span class="eqd-chip eqd-chip-cyan eqd-chip-lg"><i class="fa-solid fa-route"></i></span>
            <div class="eqd-bdiag-head-text">
              <h3 class="eqd-bdiag-title">Historique de localisation</h3>
            </div>
          </header>

          @if (locationHistoryLoading()) {
            <div class="eqd-bdiag-unavailable">
              <span class="eqd-bdiag-unavail-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>
              <h4 class="eqd-bdiag-unavail-title">Chargement de l'historique…</h4>
              <p class="eqd-bdiag-unavail-text">Récupération des positions en cours.</p>
            </div>
          } @else {
            @if (locationHistoryError()) {
              <div class="eqd-export-error" role="alert">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>{{ locationHistoryError() }}</span>
              </div>
            }

            <ol class="eqd-loc-timeline">
              @for (entry of locationHistory(); track $index) {
                <li class="eqd-loc-item">
                  <span class="eqd-loc-dot" [class.eqd-loc-dot--current]="!entry.date_fin">
                    <i
                      class="fa-solid"
                      [class.fa-location-dot]="!entry.date_fin"
                      [class.fa-map-pin]="!!entry.date_fin"
                    ></i>
                  </span>
                  <div class="eqd-loc-card" [class.eqd-loc-card--current]="!entry.date_fin">
                    <div class="eqd-loc-card-head">
                      @if (!entry.date_fin) {
                        <span class="eqd-badge eqd-badge-success">
                          <span class="eqd-badge-dot"></span>
                          Position actuelle
                        </span>
                      } @else {
                        <span class="eqd-badge eqd-badge-neutral">
                          <span class="eqd-badge-dot"></span>
                          Ancienne position
                        </span>
                      }
                      <a
                        class="eqd-maps-btn"
                        [href]="'https://www.google.com/maps?q=' + entry.lien_localisation"
                        target="_blank"
                        rel="noopener"
                      >
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>Voir sur Google Maps</span>
                      </a>
                    </div>
                    <p class="eqd-loc-place">{{ entry.localisation }}</p>
                    <p class="eqd-loc-period">
                      @if (entry.date_fin) {
                        Présence du {{ entry.date_debut | date:'dd/MM/yyyy HH:mm' }} au
                        {{ entry.date_fin | date:'dd/MM/yyyy HH:mm' }}
                      } @else {
                        À cette position depuis le {{ entry.date_debut | date:'dd/MM/yyyy HH:mm' }}
                      }
                    </p>
                  </div>
                </li>
              }

              <!-- Position actuelle issue de la fiche équipement (donnée réelle existante) -->
              @if (equipment && !hasBackendCurrentPosition()) {
                <li class="eqd-loc-item">
                  <span class="eqd-loc-dot eqd-loc-dot--current">
                    <i class="fa-solid fa-location-dot"></i>
                  </span>
                  <div class="eqd-loc-card eqd-loc-card--current">
                    <div class="eqd-loc-card-head">
                      <span class="eqd-badge eqd-badge-success">
                        <span class="eqd-badge-dot"></span>
                        Position actuelle
                      </span>
                      <a
                        class="eqd-maps-btn"
                        [href]="'https://www.google.com/maps?q=' + equipment.lienLocalisation"
                        target="_blank"
                        rel="noopener"
                      >
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>Voir sur Google Maps</span>
                      </a>
                    </div>
                    <p class="eqd-loc-place">{{ equipment.localisation }}</p>
                    <p class="eqd-loc-period">Dernier enregistrement : {{ equipment.miseEnLigne }}</p>
                  </div>
                </li>
              }
            </ol>

            @if (locationHistory().length === 0) {
              <div class="eqd-loc-note">
                <i class="fa-solid fa-circle-info"></i>
                <span>
                  Aucun historique de déplacement n'est fourni par le backend pour cet équipement.
                  Seule la position actuelle est affichée.
                </span>
              </div>
            }
          }
        </section>

        <!-- ===== Informations générales (en bas de page) ===== -->
        @if (hasInfosGenerales) {
          <section class="eqd-infos-generales">
            <header class="eqd-bdiag-head">
              <span class="eqd-chip eqd-chip-blue eqd-chip-lg"><i class="fa-solid fa-circle-info"></i></span>
              <div class="eqd-bdiag-head-text">
                <h3 class="eqd-bdiag-title">Informations générales</h3>
              </div>
            </header>
            <div class="eqd-infos-grid">
              <div class="eqd-infos-item">
                <span class="eqd-infos-key">Type / catégorie</span>
                <span class="eqd-infos-value">{{ equipment.type }}</span>
              </div>
              @if (equipment.marqueModele) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Marque / modèle</span>
                  <span class="eqd-infos-value">{{ equipment.marqueModele }}</span>
                </div>
              }
              @if (equipment.clientNom) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Nom du client</span>
                  <span class="eqd-infos-value">{{ equipment.clientNom }}</span>
                </div>
              }
              @if (equipment.clientNumero) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Numéro du client</span>
                  <span class="eqd-infos-value">{{ equipment.clientNumero }}</span>
                </div>
              }
              @if (equipment.site) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Site / emplacement</span>
                  <span class="eqd-infos-value">{{ equipment.site }}</span>
                </div>
              }
              @if (equipment.boitierId) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">ID du boîtier SHANGO</span>
                  <span class="eqd-infos-value">{{ equipment.boitierId }}</span>
                </div>
              }
              @if (equipment.responsable) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Responsable</span>
                  <span class="eqd-infos-value">{{ equipment.responsable }}</span>
                </div>
              }
              @if (equipment.perimetreMetres) {
                <div class="eqd-infos-item">
                  <span class="eqd-infos-key">Périmètre autorisé</span>
                  <span class="eqd-infos-value">{{ equipment.perimetreMetres }} m autour de la position d'installation</span>
                </div>
              }
            </div>
          </section>
        }

      }
    </div>

    @if (showStatusModal()) {
      <div class="eqd-modal-overlay" (click)="annulerChangementStatut()">
        <div class="eqd-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="eqd-modal-head">
            <span
              class="eqd-modal-icon"
              [class.eqd-modal-icon--danger]="!isBloque()"
              [class.eqd-modal-icon--success]="isBloque()"
            >
              <i class="fa-solid" [class.fa-lock]="!isBloque()" [class.fa-lock-open]="isBloque()"></i>
            </span>
            <h3 class="eqd-modal-title">
              {{ isBloque() ? "Débloquer l'équipement" : "Bloquer l'équipement" }}
            </h3>
          </div>
          <div class="eqd-modal-body">
            @if (isBloque()) {
              Voulez-vous vraiment <strong>débloquer</strong> cet équipement ?
            } @else {
              Voulez-vous vraiment <strong>bloquer</strong> cet équipement ?
            }
          </div>
          <div class="eqd-modal-actions">
            <button
              type="button"
              class="eqd-btn eqd-btn-ghost"
              (click)="annulerChangementStatut()"
              [disabled]="statusActionBusy()"
            >
              Annuler
            </button>
            <button
              type="button"
              class="eqd-btn"
              [class.eqd-btn-danger]="!isBloque()"
              [class.eqd-btn-success]="isBloque()"
              (click)="confirmerChangementStatut()"
              [disabled]="statusActionBusy()"
            >
              @if (statusActionBusy()) {
                <i class="fa-solid fa-spinner fa-spin"></i>
              }
              <span>{{ isBloque() ? "Oui, débloquer" : "Oui, bloquer" }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ==========================================================
       Page Détail de l'équipement — Dashboard SaaS premium
       Canvas lavande très clair + cartes blanches flottantes
       ========================================================== */

    :host {
      display: block;
      min-height: calc(100vh - 96px);
      padding: 16px 26px 34px;
      border-radius: 24px;
      background: #FFFFFF;
      box-sizing: border-box;
    }

    .eqd-shell {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* ===== Header ===== */
    .eqd-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    .eqd-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 13px;
      border-radius: 999px;
      background: rgba(79, 124, 255, 0.10);
      border: 1px solid rgba(79, 124, 255, 0.18);
      color: #4F7CFF;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .eqd-title {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.8px;
      color: #172033;
    }

    .eqd-subtitle {
      margin: 8px 0 0;
      font-size: 14px;
      color: #7A8499;
    }

    .eqd-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* ===== Boutons ===== */
    .eqd-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 18px;
      border-radius: 12px;
      border: 1px solid transparent;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, border-color 0.22s ease, color 0.22s ease;
    }

    .eqd-btn-ghost {
      background: #FFFFFF;
      color: #3D4A63;
      border-color: rgba(23, 32, 51, 0.08);
      box-shadow: 0 2px 10px rgba(65, 78, 120, 0.06);
    }

    .eqd-btn-ghost:hover {
      background: #FFFFFF;
      color: #172033;
      border-color: rgba(79, 124, 255, 0.28);
      transform: translateY(-1px);
      box-shadow: 0 8px 22px rgba(65, 78, 120, 0.12);
    }

    .eqd-btn-primary {
      background: #2563EB;
      color: #FFFFFF;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.30);
    }

    .eqd-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(37, 99, 235, 0.38);
      filter: brightness(1.05);
    }

    .eqd-btn-danger {
      background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
      color: #FFFFFF;
      box-shadow: 0 8px 20px rgba(239, 68, 68, 0.28);
    }

    .eqd-btn-danger:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(239, 68, 68, 0.36);
      filter: brightness(1.05);
    }

    .eqd-btn-success {
      background: #2563EB;
      color: #FFFFFF;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
    }

    .eqd-btn-success:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(37, 99, 235, 0.36);
      filter: brightness(1.05);
    }

    .eqd-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* ===== Bandeau de notification ===== */
    .eqd-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
    }

    .eqd-alert--success {
      background: #E9FBF4;
      color: #0FA97E;
      border: 1px solid rgba(32, 201, 151, 0.25);
    }

    .eqd-alert--error {
      background: #FEF1F1;
      color: #E5484D;
      border: 1px solid rgba(239, 68, 68, 0.20);
    }

    /* ===== Notification flottante : connexion/déconnexion du boîtier ===== */
    .eqd-esp-toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
      animation: eqd-esp-toast-in 0.25s ease-out;
    }

    .eqd-esp-toast--connected {
      background: #E9FBF4;
      color: #0FA97E;
      border: 1px solid rgba(32, 201, 151, 0.25);
    }

    .eqd-esp-toast--disconnected {
      background: #FFF7ED;
      color: #D97706;
      border: 1px solid rgba(217, 119, 6, 0.25);
    }

    @keyframes eqd-esp-toast-in {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 640px) {
      .eqd-esp-toast {
        left: 16px;
        right: 16px;
        bottom: 16px;
      }
    }

    /* ===== Chip d'état blocage (résumé) ===== */
    .eqd-state-chip {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
    }

    .eqd-state-chip--ok {
      background: #E9FBF4;
      color: #0FA97E;
      border: 1px solid rgba(32, 201, 151, 0.25);
    }

    .eqd-state-chip--blocked {
      background: #FEF1F1;
      color: #E5484D;
      border: 1px solid rgba(239, 68, 68, 0.20);
    }

    .eqd-state-chip--alert {
      background: #FFF4EC;
      color: #EA580C;
      border: 1px solid rgba(234, 88, 12, 0.22);
    }

    .eqd-state-chip--inspection {
      background: #FFFBEB;
      color: #D97706;
      border: 1px solid rgba(217, 119, 6, 0.22);
    }

    /* ===== Modale de confirmation ===== */
    .eqd-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(8px) saturate(1.2);
      -webkit-backdrop-filter: blur(8px) saturate(1.2);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .eqd-modal {
      width: 100%;
      max-width: 420px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.12), 0 24px 64px rgba(15, 23, 42, 0.2);
      padding: 0;
      overflow: hidden;
    }

    .eqd-modal-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: linear-gradient(180deg, #2563EB, #1D4ED8);
      border-bottom: 1px solid #1E40AF;
    }

    .eqd-modal-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .eqd-modal-icon--danger {
      background: rgba(255, 255, 255, 0.9);
      color: #EF4444;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .eqd-modal-icon--success {
      background: rgba(255, 255, 255, 0.9);
      color: #0FA97E;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .eqd-modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #FFFFFF;
    }

    .eqd-modal-body {
      margin: 0;
      padding: 20px 24px;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }

    .eqd-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 24px 22px;
    }

    /* ===== Carte résumé ===== */
    .eqd-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      background: #FFFFFF;
      border: 1px solid rgba(79, 124, 255, 0.12);
      border-radius: 20px;
      padding: 22px 24px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
    }

    .eqd-summary-main {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }

    .eqd-summary-icon {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: #2563EB;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
      flex-shrink: 0;
    }

    .eqd-summary-photo {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      object-fit: cover;
      flex-shrink: 0;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
    }

    .eqd-summary-info { min-width: 0; }

    .eqd-summary-name {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #172033;
    }

    .eqd-summary-id {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 9px;
      flex-wrap: wrap;
    }

    .eqd-id-chip {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #6D4AFF;
      background: rgba(109, 74, 255, 0.10);
      border: 1px solid rgba(109, 74, 255, 0.18);
      padding: 2px 9px;
      border-radius: 999px;
    }

    .eqd-id-value {
      font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.4px;
      color: #55607A;
    }

    .eqd-summary-side {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    .eqd-summary-sync {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #7A8499;
    }

    /* ===== Badges ===== */
    .eqd-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
      width: fit-content;
    }

    .eqd-badge-wrap { white-space: normal; }

    .eqd-badge-lg { padding: 8px 16px; font-size: 13px; }

    .eqd-badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .eqd-badge-danger {
      background: #FEF1F1;
      color: #E5484D;
      border: 1px solid rgba(239, 68, 68, 0.18);
    }

    .eqd-badge-danger .eqd-badge-dot {
      background: #EF4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.60);
    }

    .eqd-badge-warning {
      background: #FFF7E8;
      color: #D97706;
      border: 1px solid rgba(245, 158, 11, 0.20);
    }

    .eqd-badge-warning .eqd-badge-dot {
      background: #F59E0B;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.55);
    }

    .eqd-badge-success {
      background: #E9FBF4;
      color: #0FA97E;
      border: 1px solid rgba(32, 201, 151, 0.22);
    }

    .eqd-badge-success .eqd-badge-dot {
      background: #20C997;
      box-shadow: 0 0 8px rgba(32, 201, 151, 0.55);
    }

    .eqd-badge-neutral {
      background: #F1F3FA;
      color: #7A8499;
      border: 1px solid rgba(122, 132, 153, 0.18);
    }

    .eqd-badge-neutral .eqd-badge-dot {
      background: #A6AFC4;
    }

    /* ===== Grille KPI ===== */
    .eqd-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }

    .eqd-card {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 8px 30px rgba(65, 78, 120, 0.08);
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    }

    .eqd-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 36px rgba(65, 78, 120, 0.12);
      border-color: rgba(79, 124, 255, 0.18);
    }

    .eqd-card-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .eqd-chip {
      width: 42px;
      height: 42px;
      border-radius: 13px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .eqd-chip-lg {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      font-size: 19px;
    }

    .eqd-chip-blue { background: rgba(79, 124, 255, 0.12); color: #4F7CFF; }
    .eqd-chip-purple { background: rgba(109, 74, 255, 0.12); color: #6D4AFF; }
    .eqd-chip-cyan { background: rgba(14, 165, 233, 0.12); color: #0EA5E9; }
    .eqd-chip-green { background: rgba(32, 201, 151, 0.14); color: #12B886; }
    .eqd-chip-orange { background: rgba(251, 146, 60, 0.14); color: #F97316; }
    .eqd-chip-amber { background: rgba(245, 158, 11, 0.14); color: #D97706; }

    .eqd-card-label {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    .eqd-card-value {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #172033;
      overflow-wrap: anywhere;
    }

    .eqd-coords {
      font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: #3D4A63;
    }

    .eqd-value-empty {
      color: #B9C0D4;
      font-size: 28px;
      line-height: 1;
    }

    .eqd-card-foot {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .eqd-card-meta {
      font-size: 12.5px;
      color: #7A8499;
    }

    .eqd-maps-btn {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 10px;
      background: #2563EB;
      color: #FFFFFF;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.28);
      transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
    }

    .eqd-maps-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(37, 99, 235, 0.36);
      filter: brightness(1.05);
    }

    /* ===== Carte diagnostic ===== */
    .eqd-diagnostic {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .eqd-diag-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 18px;
      border-bottom: 1px dashed rgba(23, 32, 51, 0.10);
    }

    .eqd-diag-head-text { min-width: 0; }

    .eqd-diag-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #172033;
    }

    .eqd-diag-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7A8499;
    }

    .eqd-diag-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .eqd-diag-item {
      background: linear-gradient(160deg, #F8F9FF 0%, #F3F5FE 100%);
      border: 1px solid rgba(79, 124, 255, 0.10);
      border-radius: 14px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .eqd-diag-key {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.9px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    /* ===== Carte diagnostic batterie ===== */
    .eqd-battery-diag,
    .eqd-infos-generales {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 22px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .eqd-infos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 18px 24px;
    }
    .eqd-infos-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .eqd-infos-key { font-size: 11.5px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.4px; }
    .eqd-infos-value { font-size: 14px; font-weight: 600; color: #172033; word-break: break-word; }

    .eqd-bdiag-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 20px;
      border-bottom: 1px dashed rgba(23, 32, 51, 0.10);
    }

    .eqd-bdiag-head-text { min-width: 0; }

    .eqd-bdiag-head-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      flex-wrap: wrap;
    }

    .eqd-bdiag-launch {
      padding: 9px 16px;
      font-size: 13px;
    }

    .eqd-bdiag-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: #172033;
    }

    .eqd-bdiag-sub {
      margin: 3px 0 0;
      font-size: 13px;
      color: #7A8499;
    }

    /* ===== Grille état / priorité ===== */
    .eqd-bdiag-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }

    .eqd-bdiag-stat-card {
      background: linear-gradient(160deg, #F8F9FF 0%, #F3F5FE 100%);
      border: 1px solid rgba(79, 124, 255, 0.10);
      border-radius: 16px;
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .eqd-bdiag-stat-key {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    .eqd-bdiag-stat-value {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #172033;
    }

    .eqd-bdiag-state-icon {
      width: 44px;
      height: 44px;
      border-radius: 13px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
      transition: background 0.22s ease, color 0.22s ease;
    }

    .eqd-bdiag-state-icon--success {
      background: rgba(32, 201, 151, 0.12);
      color: #12B886;
    }

    .eqd-bdiag-state-icon--warning {
      background: rgba(245, 158, 11, 0.12);
      color: #D97706;
    }

    .eqd-bdiag-state-icon--danger {
      background: rgba(239, 68, 68, 0.12);
      color: #E5484D;
    }

    .eqd-bdiag-state-icon--neutral {
      background: rgba(122, 132, 153, 0.12);
      color: #7A8499;
    }

    .eqd-bdiag-state-hint {
      font-size: 12.5px;
      color: #7A8499;
      margin-top: 2px;
    }

    /* ===== Durée de vie estimée ===== */
    .eqd-bdiag-duration {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .eqd-bdiag-dur-key {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    .eqd-bdiag-dur-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .eqd-bdiag-dur-value {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.8px;
      color: #172033;
    }

    .eqd-bdiag-dur-range {
      font-size: 13.5px;
      color: #7A8499;
    }

    /* ===== Message ===== */
    .eqd-bdiag-message {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 18px 20px;
      border-radius: 16px;
      border: 1px solid rgba(23, 32, 51, 0.06);
      font-size: 14px;
      line-height: 1.5;
      color: #3D4A63;
    }

    .eqd-bdiag-msg-icon {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .eqd-bdiag-msg-text {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }

    .eqd-bdiag-msg--success {
      background: rgba(32, 201, 151, 0.06);
      border-color: rgba(32, 201, 151, 0.18);
    }

    .eqd-bdiag-msg--success .eqd-bdiag-msg-icon {
      background: rgba(32, 201, 151, 0.12);
      color: #12B886;
    }

    .eqd-bdiag-msg--warning {
      background: rgba(245, 158, 11, 0.06);
      border-color: rgba(245, 158, 11, 0.18);
    }

    .eqd-bdiag-msg--warning .eqd-bdiag-msg-icon {
      background: rgba(245, 158, 11, 0.12);
      color: #D97706;
    }

    .eqd-bdiag-msg--danger {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.18);
    }

    .eqd-bdiag-msg--danger .eqd-bdiag-msg-icon {
      background: rgba(239, 68, 68, 0.12);
      color: #E5484D;
    }

    .eqd-bdiag-msg--neutral {
      background: rgba(122, 132, 153, 0.06);
      border-color: rgba(122, 132, 153, 0.18);
    }

    .eqd-bdiag-msg--neutral .eqd-bdiag-msg-icon {
      background: rgba(122, 132, 153, 0.12);
      color: #7A8499;
    }

    /* ===== Diagnostic indisponible ===== */
    .eqd-bdiag-unavailable {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
      padding: 32px 20px;
    }

    .eqd-bdiag-unavail-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(122, 132, 153, 0.10);
      color: #7A8499;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .eqd-bdiag-unavail-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #172033;
    }

    .eqd-bdiag-unavail-text {
      margin: 0;
      font-size: 13.5px;
      color: #7A8499;
      max-width: 420px;
    }

    /* ===== Carte historique batterie ===== */
    .eqd-battery-history {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 22px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
      display: flex;
      flex-direction: column;
      gap: 22px;
      min-width: 0;
      overflow: hidden;
    }

    .eqd-export-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #FEF3F2;
      border: 1px solid rgba(229, 72, 77, 0.25);
      color: #B42318;
      font-size: 13px;
      font-weight: 500;
    }

    .eqd-export-error i { color: #E5484D; }

    /* ===== Historique de localisation ===== */
    .eqd-loc-history {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 22px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
      display: flex;
      flex-direction: column;
      gap: 22px;
      min-width: 0;
      overflow: hidden;
    }

    .eqd-loc-timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .eqd-loc-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      min-width: 0;
    }

    .eqd-loc-dot {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      background: rgba(14, 165, 233, 0.10);
      color: #0EA5E9;
      border: 1px solid rgba(14, 165, 233, 0.22);
      z-index: 1;
    }

    /* Trait vertical reliant chaque point au suivant */
    .eqd-loc-item:not(:last-child) .eqd-loc-dot::after {
      content: '';
      position: absolute;
      top: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 12px;
      background: rgba(14, 165, 233, 0.25);
    }

    .eqd-loc-dot--current {
      background: rgba(16, 185, 129, 0.12);
      color: #10B981;
      border-color: rgba(16, 185, 129, 0.30);
      animation: eqdLocPulse 2s ease-out infinite;
    }

    @keyframes eqdLocPulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .eqd-loc-card {
      flex: 1 1 auto;
      min-width: 0;
      background: #F8FAFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .eqd-loc-card--current {
      background: rgba(16, 185, 129, 0.05);
      border-color: rgba(16, 185, 129, 0.20);
    }

    .eqd-loc-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .eqd-loc-place {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #172033;
      overflow-wrap: anywhere;
    }

    .eqd-loc-period {
      margin: 0;
      font-size: 12.5px;
      color: #7A8499;
    }

    .eqd-loc-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      background: rgba(79, 124, 255, 0.06);
      border: 1px solid rgba(79, 124, 255, 0.14);
      color: #5A6B8C;
      font-size: 13px;
    }

    .eqd-loc-note i { color: #4F7CFF; flex-shrink: 0; margin-top: 1px; }

    @media (max-width: 768px) {
      .eqd-loc-history { padding: 22px; }
      .eqd-loc-card-head .eqd-maps-btn { width: 100%; justify-content: center; }
    }

    @media (max-width: 560px) {
      .eqd-loc-history { padding: 20px; }
      .eqd-loc-item { gap: 10px; }
      .eqd-loc-card { padding: 12px 14px; }
    }

    /* ===== Mesures capteurs ===== */
    .eqd-bdiag-measures {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .eqd-bdiag-measure {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 14px;
      padding: 14px 16px;
      min-width: 0;
    }

    .eqd-bdiag-measure-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .eqd-bdiag-measure-icon--blue { background: rgba(79, 124, 255, 0.12); color: #4F7CFF; }
    .eqd-bdiag-measure-icon--green { background: rgba(32, 201, 151, 0.14); color: #12B886; }
    .eqd-bdiag-measure-icon--orange { background: rgba(245, 158, 11, 0.14); color: #D97706; }
    .eqd-bdiag-measure-icon--red { background: rgba(239, 68, 68, 0.12); color: #EF4444; }
    .eqd-bdiag-measure-icon--cyan { background: rgba(6, 182, 212, 0.12); color: #0891B2; }
    .eqd-bdiag-measure-icon--purple { background: rgba(139, 92, 246, 0.12); color: #7C3AED; }

    .eqd-bdiag-measure-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .eqd-bdiag-measure-value--success { color: #12B886; }
    .eqd-bdiag-measure-value--warning { color: #D97706; }
    .eqd-bdiag-measure-value--danger { color: #EF4444; }

    .eqd-bdiag-measure-key {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    .eqd-bdiag-measure-value {
      font-size: 17px;
      font-weight: 700;
      color: #172033;
      overflow-wrap: anywhere;
    }

    /* ===== Capacité restante + durée de vie ===== */
    .eqd-bdiag-duration-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    @media (max-width: 900px) {
      .eqd-bdiag-measures { grid-template-columns: 1fr; }
      .eqd-bdiag-duration-row { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .eqd-battery-history { padding: 22px; }
    }

    @media (max-width: 560px) {
      .eqd-battery-history { padding: 20px; }
    }

    @media (max-width: 400px) {
      .eqd-battery-history { padding: 18px; }
    }

    /* ===== État vide ===== */
    .eqd-empty {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(65, 78, 120, 0.08);
      padding: 56px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
    }

    .eqd-empty-icon {
      width: 60px;
      height: 60px;
      border-radius: 18px;
      background: rgba(239, 68, 68, 0.10);
      color: #EF4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .eqd-empty-text {
      margin: 0;
      font-size: 14.5px;
      color: #7A8499;
    }

    /* ===== Responsive ===== */
    @media (max-width: 900px) {
      .eqd-diag-grid { grid-template-columns: 1fr; }
      .eqd-bdiag-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      :host {
        padding: 18px 16px 26px;
        border-radius: 18px;
        min-height: calc(100vh - 84px);
      }

      .eqd-header {
        flex-direction: column;
        align-items: stretch;
      }

      .eqd-title { font-size: 24px; }

      .eqd-header-actions { width: 100%; }

      .eqd-header-actions .eqd-btn { flex: 1 1 auto; }

      .eqd-summary {
        flex-direction: column;
        align-items: flex-start;
      }

      .eqd-summary-side {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        flex-wrap: wrap;
      }

      .eqd-battery-diag { padding: 22px; }

      .eqd-modal-actions { flex-direction: column; }
      .eqd-modal-actions .eqd-btn { width: 100%; }
    }

    @media (max-width: 560px) {
      .eqd-grid { grid-template-columns: 1fr; }

      .eqd-title { font-size: 22px; }

      .eqd-summary-icon {
        width: 48px;
        height: 48px;
        font-size: 19px;
      }

      .eqd-card-value { font-size: 20px; }

      .eqd-battery-diag { padding: 20px; }

      .eqd-bdiag-head {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .eqd-bdiag-dur-value { font-size: 26px; }
    }

    @media (max-width: 400px) {
      :host { padding: 14px 12px 22px; }

      .eqd-summary { padding: 18px; }

      .eqd-card { padding: 18px; }

      .eqd-diagnostic { padding: 18px; }

      .eqd-battery-diag { padding: 18px; }
    }

    /* ===== Intervention & affectations (vue depuis /maintenance) ===== */
    .eqd-interv {
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.06);
      border-radius: 22px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(65, 78, 120, 0.10);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .eqd-interv-block {
      background: linear-gradient(160deg, #F8F9FF 0%, #F3F5FE 100%);
      border: 1px solid rgba(79, 124, 255, 0.10);
      border-radius: 16px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .eqd-interv-block-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #172033;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .eqd-interv-block-title i {
      color: #4F7CFF;
    }

    .eqd-interv-tech-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .eqd-interv-tech-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      background: #FFFFFF;
      border: 1px solid rgba(23, 32, 51, 0.08);
      min-width: 0;
    }

    .eqd-interv-tech-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(79, 124, 255, 0.12);
      color: #4F7CFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }

    .eqd-interv-tech-name {
      font-size: 15px;
      font-weight: 600;
      color: #172033;
      min-width: 0;
    }

    .eqd-interv-tech-tel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #4F7CFF;
      text-decoration: none;
      margin-left: auto;
    }

    .eqd-interv-tech-tel:hover {
      text-decoration: underline;
    }

    .eqd-interv-tech-tel--muted {
      color: #94A3B8;
      margin-left: auto;
    }

    .eqd-interv-empty {
      margin: 0;
      font-size: 13px;
      color: #7A8499;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .eqd-interv-empty i {
      color: #94A3B8;
    }

    .eqd-interv-plan-card {
      border: 1px solid rgba(23, 32, 51, 0.08);
      border-radius: 12px;
      background: #FFFFFF;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .eqd-interv-plan-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 0;
    }

    .eqd-interv-plan-key {
      flex-shrink: 0;
      width: 110px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #8A93A8;
    }

    .eqd-interv-plan-val {
      font-size: 14px;
      color: #172033;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .eqd-interv-plan-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(79, 124, 255, 0.12);
      color: #4F7CFF;
    }

    .eqd-interv-plan-tag {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      color: #10B981;
    }
  `]
})
export class EquipmentDetailPageComponent implements OnInit, OnDestroy {
  equipment: Equipment | null = null;
  diagnostic: EquipmentDiagnostic = { etat: 'État normal', gravite: '—', anomalie: null };

  /** Nom affiché en en-tête : le suffixe « #XXX » (instance) est retiré, l'ID en dessous suffit à identifier l'équipement précis. */
  /** true si au moins un champ complémentaire (marque, client, site…) est renseigné. */
  get hasInfosGenerales(): boolean {
    const e = this.equipment;
    if (!e) return false;
    return !!(e.marqueModele || e.clientNom || e.clientNumero || e.site || e.boitierId || e.responsable || e.perimetreMetres);
  }

  /* ===== États asynchrones en signals — app zoneless (Angular sans zone.js) :
     une mutation de propriété simple ne déclenche PAS la détection de
     changements ; seuls les signals garantissent la mise à jour de la vue
     après les callbacks HTTP. ===== */
  /** Résultat du dernier diagnostic courant — GET /api/batterie/{device_id}/actuel. */
  readonly batteryDiagnostic = signal<BatteryCurrentDiagnostic | null>(null);
  readonly batteryHistory = signal<BatteryHistoryEntry[]>([]);
  readonly batteryLoading = signal(false);
  readonly batteryHistoryLoading = signal(false);
  readonly batteryError = signal<string | null>(null);
  /** Dernière télémétrie reçue du boîtier IoT — GET /api/equipements/{backendId}/telemetries. */
  readonly latestTelemetrie = signal<TelemetrieEntry | null>(null);
  /** Historique de localisation (GET /api/equipements/{id}/localisations). */
  readonly locationHistory = signal<LocationHistoryEntry[]>([]);
  readonly locationHistoryLoading = signal(false);
  readonly locationHistoryError = signal<string | null>(null);
  /** true dès que l'utilisateur a lancé un diagnostic via le bouton. */
  readonly batteryDiagnosticLaunched = signal(false);
  /** true si le dernier diagnostic a été arrêté manuellement par l'utilisateur. */
  readonly batteryDiagnosticArrete = signal(false);
  /** Abonnement HTTP du diagnostic en cours (permet l'arrêt via le bouton « Arrêter »). */
  private batteryDiagnosticSubscription: Subscription | null = null;
  source: 'equipment' | 'alerts' | 'maintenance' = 'equipment';
  isAlertTaken = false;

  /* ===== Bloquer / Débloquer ===== */
  protected readonly showStatusModal = signal(false);
  protected readonly statusActionBusy = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusMessageType = signal<'success' | 'error'>('success');
  private statusMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService,
    private usersService: UsersService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const sourceParam = this.route.snapshot.queryParamMap.get('source');
    if (sourceParam === 'alerts') {
      this.source = 'alerts';
    } else if (sourceParam === 'maintenance') {
      this.source = 'maintenance';
    }

    if (id) {
      const eq = this.equipmentService.getById(id);
      if (eq) {
        this.equipment = eq;
        this.diagnostic = this.equipmentService.getDiagnostic(eq);
        this.checkAlertStatus();
        this.loadLatestTelemetrie(eq);
      }
      // Rafraîchit depuis le vrai backend (utile en cas d'accès direct à
      // l'URL avant que le parc réel ait été chargé, ou si l'équipement a
      // été créé depuis un autre poste).
      this.equipmentService.load().subscribe(() => {
        const refreshed = this.equipmentService.getById(id);
        if (refreshed) {
          this.equipment = refreshed;
          this.diagnostic = this.equipmentService.getDiagnostic(refreshed);
          this.checkAlertStatus();
          this.loadLatestTelemetrie(refreshed);
        }
      });
      // Historique batterie : consommation des endpoints backend.
      // (Le frontend n'exécute aucune prédiction IA.)
      // Le diagnostic courant n'est PAS lancé automatiquement : il démarre
      // uniquement quand l'utilisateur clique sur « Lancer un diagnostic ».
      this.loadBatteryHistory(id);
      this.loadLocationHistory(id);
    }
  }

  /** Rafraîchissement automatique de la télémétrie (le bridge IoT envoie en continu). */
  private telemetriePollingSubscription: Subscription | null = null;
  private static readonly TELEMETRIE_POLL_MS = 5000;
  /**
   * Durée sans nouvelle télémétrie au-delà de laquelle on considère le
   * boîtier injoignable et on repasse les cartes à « Donnée non disponible »,
   * sans attendre un rechargement manuel de la page. Volontairement plus
   * long que l'intervalle d'envoi réel du boîtier (10s tapis à tapis,
   * vérifié sur SH-001) pour absorber un envoi manqué isolé sans faire
   * clignoter l'affichage entre deux télémétries normales.
   *
   * Était à 8000 (< 10000) : l'affichage basculait donc systématiquement en
   * « non disponible » pendant les ~2 dernières secondes de chaque cycle,
   * avant l'arrivée de la télémétrie suivante — pas un envoi manqué, juste
   * un seuil plus court que l'intervalle réel du boîtier.
   */
  private static readonly TELEMETRIE_STALE_MS = 15000;
  /** Horodatage navigateur (Date.now()) de la dernière télémétrie affichée. */
  private lastTelemetrieReceivedAt: number | null = null;
  /**
   * Horodatage de la télémétrie déjà connue au moment de l'ouverture de la
   * page (ou de la dernière mise à jour affichée) — sert de référence pour
   * ne montrer QUE les données reçues pendant la session en cours. Sans ça,
   * une vieille télémétrie encore en base s'afficherait dès l'ouverture,
   * donnant l'impression (à tort) d'une donnée figée/mockée.
   */
  private telemetrieBaselineHorodatage: string | null = null;

  /**
   * Notification flottante (bas à droite) signalant la connexion/déconnexion
   * du boîtier — distincte de statusMessage (feedback bloquer/débloquer).
   * Suit hasLiveTelemetrie() ci-dessous : true -> "connecté", false ->
   * "déconnecté", uniquement sur un CHANGEMENT d'état pendant la session en
   * cours (pas à l'ouverture de la page, qui démarre volontairement sans
   * télémétrie affichée — voir loadLatestTelemetrie).
   */
  protected readonly espConnectionToast = signal<{ message: string; connected: boolean } | null>(null);
  private espWasConnected = false;
  private espToastTimeout: ReturnType<typeof setTimeout> | null = null;

  private showEspConnectionToast(connected: boolean): void {
    if (this.espToastTimeout) clearTimeout(this.espToastTimeout);
    const label = this.equipment?.boitierId ?? this.equipment?.nom ?? 'Le boîtier';
    this.espConnectionToast.set({
      message: connected ? `${label} connecté` : `${label} déconnecté`,
      connected
    });
    this.espToastTimeout = setTimeout(() => this.espConnectionToast.set(null), 6000);
  }

  /**
   * Dernière télémétrie IoT — GET /api/equipements/{backendId}/telemetries.
   * À l'ouverture, on capture la référence existante SANS l'afficher (les
   * cartes restent sur « Donnée non disponible »), puis seule une nouvelle
   * télémétrie reçue après coup (donc pendant que la page est ouverte) est
   * affichée — preuve visuelle qu'il s'agit bien d'un flux en direct.
   * Si plus aucune nouvelle télémétrie n'arrive pendant TELEMETRIE_STALE_MS
   * (boîtier éteint/déconnecté), les cartes repassent seules à « non
   * disponible » sans qu'un rechargement de page soit nécessaire.
   */
  private loadLatestTelemetrie(equipment: Equipment): void {
    if (!equipment.backendId) return;
    const backendId = equipment.backendId;

    this.espWasConnected = false;
    this.latestTelemetrie.set(null);
    this.telemetrieBaselineHorodatage = null;
    this.lastTelemetrieReceivedAt = null;
    this.telemetriePollingSubscription?.unsubscribe();

    this.equipmentService.getLatestTelemetrie(backendId).subscribe(baseline => {
      this.telemetrieBaselineHorodatage = baseline?.horodatage ?? null;

      this.telemetriePollingSubscription = interval(EquipmentDetailPageComponent.TELEMETRIE_POLL_MS).subscribe(() => {
        this.equipmentService.getLatestTelemetrie(backendId).subscribe(entry => {
          this.applyTelemetrieIfNewer(entry);
        });
        this.checkTelemetrieStale();
      });
    });
  }

  /** N'affiche une télémétrie que si elle est plus récente que la référence connue. */
  private applyTelemetrieIfNewer(entry: TelemetrieEntry | null): void {
    if (!entry) return;
    const isNewer =
      !this.telemetrieBaselineHorodatage ||
      new Date(entry.horodatage).getTime() > new Date(this.telemetrieBaselineHorodatage).getTime();
    if (isNewer) {
      this.latestTelemetrie.set(entry);
      this.telemetrieBaselineHorodatage = entry.horodatage;
      this.lastTelemetrieReceivedAt = Date.now();
      if (!this.espWasConnected) {
        this.espWasConnected = true;
        this.showEspConnectionToast(true);
      }
    }
  }

  /** Repasse les cartes à « non disponible » si plus rien n'arrive depuis trop longtemps. */
  private checkTelemetrieStale(): void {
    if (this.latestTelemetrie() === null || this.lastTelemetrieReceivedAt === null) return;
    const elapsed = Date.now() - this.lastTelemetrieReceivedAt;
    if (elapsed > EquipmentDetailPageComponent.TELEMETRIE_STALE_MS) {
      this.latestTelemetrie.set(null);
      if (this.espWasConnected) {
        this.espWasConnected = false;
        this.showEspConnectionToast(false);
      }
    }
  }

  ngOnDestroy(): void {
    this.telemetriePollingSubscription?.unsubscribe();
    this.batteryDiagnosticSubscription?.unsubscribe();
    if (this.espToastTimeout) clearTimeout(this.espToastTimeout);
  }

  /** Historique de localisation — GET /api/equipements/{id}/localisations. */
  private loadLocationHistory(id: string): void {
    this.locationHistoryLoading.set(true);
    this.equipmentService.getEquipmentLocationHistory(id).subscribe({
      next: entries => {
        this.locationHistory.set(entries);
        this.locationHistoryLoading.set(false);
        this.locationHistoryError.set(this.equipmentService.locationHistoryError());
      },
      error: () => {
        this.locationHistoryLoading.set(false);
        this.locationHistoryError.set(
          this.equipmentService.locationHistoryError() ??
          "Erreur lors de la récupération de l'historique de localisation."
        );
      }
    });
  }

  /**
   * true si le backend fournit déjà la position actuelle dans l'historique
   * (entrée sans date de fin) — évite alors le doublon avec la fiche équipement.
   */
  hasBackendCurrentPosition(): boolean {
    return this.locationHistory().some(entry => !entry.date_fin);
  }

  /** Récupère le diagnostic courant — GET /api/batterie/{device_id}/actuel. */
  private loadBatteryDiagnostic(id: string): void {
    this.batteryLoading.set(true);
    this.batteryError.set(null);
    this.batteryDiagnosticSubscription = this.equipmentService
      .getBatteryCurrentDiagnostic(id)
      .subscribe({
        next: result => {
          this.batteryDiagnosticSubscription = null;
          this.batteryLoading.set(false);
          this.batteryDiagnostic.set(result);
          this.batteryError.set(this.equipmentService.batteryApiError());
        },
        error: () => {
          this.batteryDiagnosticSubscription = null;
          this.batteryLoading.set(false);
          this.batteryError.set(
            this.equipmentService.batteryApiError() ??
            'Erreur lors de la récupération du diagnostic batterie.'
          );
        }
      });
  }

  /**
   * Lance le diagnostic batterie à la demande (bouton « Lancer un diagnostic »).
   * Appelle GET /api/batterie/{device_id}/actuel — aucune prédiction côté frontend,
   * le backend reste l'unique source des résultats.
   */
  lancerDiagnostic(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || this.batteryLoading()) return;
    this.batteryDiagnosticLaunched.set(true);
    this.batteryDiagnosticArrete.set(false);
    this.loadBatteryDiagnostic(id);
  }

  /** Arrête le diagnostic en cours (bouton « Arrêter ») : annule la requête HTTP. */
  arreterDiagnostic(): void {
    if (this.batteryDiagnosticSubscription) {
      this.batteryDiagnosticSubscription.unsubscribe();
      this.batteryDiagnosticSubscription = null;
    }
    this.batteryLoading.set(false);
    this.batteryDiagnosticArrete.set(true);
  }

  /** Action du bouton : lance le diagnostic, ou l'arrête s'il est en cours. */
  basculerDiagnostic(): void {
    if (this.batteryLoading()) {
      this.arreterDiagnostic();
    } else {
      this.lancerDiagnostic();
    }
  }

  /** Récupère l'historique — GET /api/batterie/{device_id}/historique. */
  private loadBatteryHistory(id: string): void {
    this.batteryHistoryLoading.set(true);
    this.equipmentService.getBatteryHistory(id).subscribe({
      next: list => {
        this.batteryHistoryLoading.set(false);
        this.batteryHistory.set(list);
      },
      error: () => {
        this.batteryHistoryLoading.set(false);
        this.batteryHistory.set([]);
      }
    });
  }

  /** Titre de l'état « diagnostic indisponible » (non lancé, arrêté, erreur ou absence de données). */
  get batteryUnavailableTitle(): string {
    if (this.batteryDiagnosticArrete()) return 'Diagnostic arrêté';
    if (!this.batteryDiagnosticLaunched()) return 'Aucun diagnostic lancé';
    if (this.batteryError()) return 'Diagnostic momentanément indisponible';
    return 'Diagnostic indisponible';
  }

  get batteryUnavailableMessage(): string {
    if (this.batteryDiagnosticArrete()) {
      return 'Le diagnostic a été arrêté. Relancez-le quand vous le souhaitez.';
    }
    if (!this.batteryDiagnosticLaunched()) {
      return 'Cliquez sur « Lancer un diagnostic » pour analyser la batterie de cet équipement.';
    }
    const erreur = this.batteryError();
    if (erreur) return erreur;
    return "Aucune donnée de diagnostic n'est disponible pour cet équipement.";
  }

  private checkAlertStatus(): void {
    if (!this.equipment) return;
    const maintenanceItems = this.maintenanceService.getItems();
    const item = maintenanceItems.find(i => i.equipment === this.equipment!.nom);
    this.isAlertTaken = item?.prisPar != null;
  }

  /* ============================================================
     Bloquer / Débloquer l'équipement
     ============================================================ */

  /** L'équipement est-il actuellement bloqué ? (champ backend `bloque`, absent = actif) */
  protected isBloque(): boolean {
    return this.equipment?.bloque === true;
  }

  /**
   * Droit de bloquer/débloquer : réservé à SUPERADMIN et ADMIN_STRUCTURE,
   * conformément aux règles existantes (un technicien USER n'a pas cette action).
   */
  protected canManageEquipment(): boolean {
    return this.authService.isSuperAdmin() || this.authService.isStructureAdmin();
  }

  /** Ouvre la modale de confirmation. */
  protected demanderChangementStatut(): void {
    if (this.statusActionBusy() || !this.equipment) return;
    this.showStatusModal.set(true);
  }

  /** Ferme la modale sans rien modifier. */
  protected annulerChangementStatut(): void {
    if (this.statusActionBusy()) return;
    this.showStatusModal.set(false);
  }

  /**
   * Envoie la vraie commande au boîtier (POST /api/commande, via le Bridge
   * IoT), puis seulement si elle réussit, met à jour l'état affiché (voir
   * EquipmentService.setEquipmentStatus). En cas d'échec (ex. Bridge
   * injoignable), l'état affiché n'est PAS modifié — pas de faux "Bloqué"
   * si la commande n'a pas pu être transmise.
   */
  protected confirmerChangementStatut(): void {
    if (this.statusActionBusy() || !this.equipment) return;
    const id = this.equipment.id;
    const willBlock = !this.isBloque();
    this.statusActionBusy.set(true);

    this.equipmentService.setEquipmentStatus(id, willBlock).subscribe({
      next: result => {
        this.statusActionBusy.set(false);
        this.showStatusModal.set(false);
        if (result) {
          this.setStatusMessage(
            willBlock
              ? "L'équipement a été bloqué avec succès."
              : "L'équipement a été débloqué avec succès.",
            'success'
          );
        } else {
          this.setStatusMessage(
            this.equipmentService.equipmentStatusError() ??
              "Impossible de changer l'état de l'équipement.",
            'error'
          );
        }
      },
      error: () => {
        this.statusActionBusy.set(false);
        this.showStatusModal.set(false);
        this.setStatusMessage(
          this.equipmentService.equipmentStatusError() ??
            "Impossible de changer l'état de l'équipement.",
          'error'
        );
      }
    });
  }

  private setStatusMessage(message: string, type: 'success' | 'error'): void {
    if (this.statusMessageTimeout) {
      clearTimeout(this.statusMessageTimeout);
    }
    this.statusMessage.set(message);
    this.statusMessageType.set(type);
    this.statusMessageTimeout = setTimeout(() => this.statusMessage.set(''), 5000);
  }

  get backButtonText(): string {
    switch (this.source) {
      case 'alerts': return 'Retour aux alertes';
      case 'maintenance': return 'Retour à la maintenance';
      default: return 'Retour au parc d\'équipement';
    }
  }

  /** Icône selon le type d'équipement (présentation uniquement) */
  get typeIcon(): string {
    switch (this.equipment?.type) {
      case 'Kit solaire': return 'fa-solar-panel';
      case 'Véhicule': return 'fa-truck-fast';
      case 'Engin minier': return 'fa-helmet-safety';
      default: return 'fa-microchip';
    }
  }

  /**
   * Statut unifié affiché sur la page détail (une seule pastille pour éviter
   * toute confusion). Priorité : bloqué > En alerte > À inspecter > Rien à signaler.
   */
  get unifiedStatusLabel(): string {
    if (this.isBloque()) return '🔴 Équipement bloqué';
    switch (this.equipment?.statut) {
      case 'En alerte': return '⚠️ En alerte';
      case 'Inspection': return '🔍 À inspecter';
      default: return '🟢 Rien à signaler';
    }
  }

  /** Classe de présentation de la pastille de statut unifié. */
  get unifiedStatusClass(): string {
    if (this.isBloque()) return 'eqd-state-chip--blocked';
    switch (this.equipment?.statut) {
      case 'En alerte': return 'eqd-state-chip--alert';
      case 'Inspection': return 'eqd-state-chip--inspection';
      default: return 'eqd-state-chip--ok';
    }
  }

  /** Classe de badge de l'état du diagnostic */
  get etatBadgeClass(): string {
    const etat = this.diagnostic.etat;
    if (etat.includes('Anomalie')) return 'eqd-badge-danger';
    if (etat.includes('Inspection')) return 'eqd-badge-warning';
    return 'eqd-badge-success';
  }

  /** Classe de badge de la gravité */
  get graviteBadgeClass(): string {
    switch (this.diagnostic.gravite) {
      case 'Élevée': return 'eqd-badge-danger';
      case 'Moyenne': return 'eqd-badge-warning';
      default: return 'eqd-badge-neutral';
    }
  }

  /** Classe de badge de l'anomalie */
  get anomalieBadgeClass(): string {
    if (!this.diagnostic.anomalie) return 'eqd-badge-neutral';
    return this.diagnostic.anomalie.includes('Alerte') ? 'eqd-badge-danger' : 'eqd-badge-warning';
  }

  /* ===== Getters pour le diagnostic batterie ===== */

  /**
   * État effectif affiché : la valeur `etat` fournie par le backend est
   * prioritaire ; à défaut, on applique les seuils SOH comme règle d'affichage
   * (SOH ≥ 80 → Bon, 70 ≤ SOH < 80 → Surveiller, SOH < 70 → À remplacer).
   */
  private get effectiveEtat(): string {
    const etatApi = this.batteryDiagnostic()?.etat;
    if (etatApi) return this.normalizeEtat(etatApi);
    const soh = this.batteryDiagnostic()?.soh_pourcent;
    if (soh === null || soh === undefined) return 'Indéterminé';
    if (soh >= 80) return 'Bon';
    if (soh >= 70) return 'Surveiller';
    return 'À remplacer';
  }

  private normalizeEtat(etat: string | null | undefined): string {
    if (!etat) return 'Indéterminé';
    return etat === 'A_remplacer' ? 'À remplacer' : etat;
  }

  /** Affichage de l'état de la batterie (A_remplacer → À remplacer). */
  get batteryEtatDisplay(): string {
    if (!this.batteryDiagnostic()) return '';
    return this.effectiveEtat;
  }

  /** Classe de badge de l'état de la batterie. */
  get batteryStateBadgeClass(): string {
    if (!this.batteryDiagnostic()) return 'eqd-badge-neutral';
    switch (this.effectiveEtat) {
      case 'Bon': return 'eqd-badge-success';
      case 'Surveiller': return 'eqd-badge-warning';
      case 'À remplacer': return 'eqd-badge-danger';
      default: return 'eqd-badge-neutral';
    }
  }

  /** Classe du conteneur d'icône d'état. */
  get batteryStateIconClass(): string {
    if (!this.batteryDiagnostic()) return 'eqd-bdiag-state-icon--neutral';
    switch (this.effectiveEtat) {
      case 'Bon': return 'eqd-bdiag-state-icon--success';
      case 'Surveiller': return 'eqd-bdiag-state-icon--warning';
      case 'À remplacer': return 'eqd-bdiag-state-icon--danger';
      default: return 'eqd-bdiag-state-icon--neutral';
    }
  }

  /** Icône FontAwesome selon l'état de la batterie. */
  get batteryStateIcon(): string {
    if (!this.batteryDiagnostic()) return 'fa-solid fa-battery';
    switch (this.effectiveEtat) {
      case 'Bon': return 'fa-solid fa-battery-full';
      case 'Surveiller': return 'fa-solid fa-battery-quarter';
      case 'À remplacer': return 'fa-solid fa-battery-empty';
      default: return 'fa-solid fa-battery';
    }
  }

  /** Message d'information sous l'état de la batterie. */
  get batteryStateHint(): string {
    if (!this.batteryDiagnostic()) return '';
    switch (this.effectiveEtat) {
      case 'Bon': return 'Aucune action particulière nécessaire.';
      case 'Surveiller': return 'Surveillance régulière recommandée.';
      case 'À remplacer': return 'Planifier le remplacement de la batterie.';
      default: return '';
    }
  }

  /** Rappel visuel des seuils SOH utilisés en l'absence de valeur `etat`. */
  get batterySohHint(): string {
    const soh = this.batteryDiagnostic()?.soh_pourcent;
    if (soh === null || soh === undefined) return '';
    if (soh >= 80) return 'Seuil ≥ 80 % : Bon';
    if (soh >= 70) return 'Seuil 70–79 % : Surveiller';
    return 'Seuil < 70 % : À remplacer';
  }

  /** Classe du conteneur de message. */
  get batteryMessageClass(): string {
    if (!this.batteryDiagnostic()) return '';
    switch (this.effectiveEtat) {
      case 'Bon': return 'eqd-bdiag-msg--success';
      case 'Surveiller': return 'eqd-bdiag-msg--warning';
      case 'À remplacer': return 'eqd-bdiag-msg--danger';
      default: return 'eqd-bdiag-msg--neutral';
    }
  }

  /** Icône du message de maintenance. */
  get batteryMessageIcon(): string {
    if (!this.batteryDiagnostic()) return 'fa-solid fa-circle-info';
    switch (this.effectiveEtat) {
      case 'Bon': return 'fa-solid fa-check-circle';
      case 'Surveiller': return 'fa-solid fa-exclamation-triangle';
      case 'À remplacer': return 'fa-solid fa-circle-exclamation';
      default: return 'fa-solid fa-circle-info';
    }
  }

  get batteryMessageDisplay(): string {
    return (
      this.batteryDiagnostic()?.message ||
      'Aucun message de maintenance fourni par le backend.'
    );
  }

  get batteryVoltageDisplay(): string {
    const v = this.batteryDiagnostic()?.voltage_v;
    return v !== null && v !== undefined ? `${Number(v).toFixed(2)} V` : '—';
  }

  get batteryCurrentDisplay(): string {
    const v = this.batteryDiagnostic()?.current_a;
    return v !== null && v !== undefined ? `${Number(v).toFixed(2)} A` : '—';
  }

  get batteryTemperatureDisplay(): string {
    const v = this.batteryDiagnostic()?.temperature_c;
    return v !== null && v !== undefined ? `${Number(v).toFixed(1)} °C` : '—';
  }

  get batteryDodDisplay(): string {
    const v = this.batteryDiagnostic()?.dod_percent;
    return v !== null && v !== undefined ? `${Number(v).toFixed(1)} %` : '—';
  }

  get batteryHumidityDisplay(): string {
    const v = this.batteryDiagnostic()?.humidite_pourcent;
    return v !== null && v !== undefined ? `${Number(v).toFixed(0)} %` : '—';
  }

  get batteryPaiementDisplay(): string {
    return this.batteryDiagnostic()?.statut_paiement ?? '—';
  }

  /** Couleur du statut de paiement (vert = à jour, rouge = impayé, ambre = en retard). */
  get paiementStatusClass(): string {
    const statut = (this.latestTelemetrie()?.statut_paiement ?? '').toLowerCase();
    if (statut.includes('impay') || statut === 'bloque') return 'eqd-bdiag-measure-value--danger';
    if (statut.includes('retard')) return 'eqd-bdiag-measure-value--warning';
    if (statut === 'ok' || statut.includes('pay')) return 'eqd-bdiag-measure-value--success';
    return '';
  }

  /* ===== Cartes vue d'ensemble alimentées par la dernière télémétrie IoT ===== */
  get telemetrieCourantDisplay(): string {
    const v = this.latestTelemetrie()?.courant;
    return v !== null && v !== undefined ? `${Number(v).toFixed(2)} A` : '—';
  }

  get telemetrieTemperatureDisplay(): string {
    const v = this.latestTelemetrie()?.temperature;
    return v !== null && v !== undefined ? `${Number(v).toFixed(1)} °C` : '—';
  }

  get telemetrieTensionDisplay(): string {
    const v = this.latestTelemetrie()?.tension;
    return v !== null && v !== undefined ? `${Number(v).toFixed(2)} V` : '—';
  }

  get telemetrieEtatKitDisplay(): string {
    const etat = this.latestTelemetrie()?.etat_kit;
    if (etat === 'MARCHE') return 'En marche';
    if (etat === 'BLOQUE') return 'Bloqué';
    return etat ?? '—';
  }

  /** Couleur de la carte État du kit (vert = en marche, rouge = bloqué). */
  get etatKitStatusClass(): string {
    const etat = this.latestTelemetrie()?.etat_kit;
    if (etat === 'BLOQUE') return 'eqd-bdiag-measure-value--danger';
    if (etat === 'MARCHE') return 'eqd-bdiag-measure-value--success';
    return '';
  }

  get telemetrieHumiditeDisplay(): string {
    const v = this.latestTelemetrie()?.humidite;
    return v !== null && v !== undefined ? `${Number(v).toFixed(1)} %` : '—';
  }

  /**
   * true seulement si le boîtier a un vrai fix GPS. Un boîtier sans fix
   * satellite envoie {latitude: 0, longitude: 0} ("Null Island") plutôt que
   * d'omettre le champ — traité ici comme une absence de donnée, pas comme
   * une position réelle (le parc SHANGO n'est jamais à 0°,0°).
   */
  hasGpsFix(): boolean {
    const t = this.latestTelemetrie();
    if (!t || t.latitude === null || t.longitude === null) return false;
    return t.latitude !== 0 || t.longitude !== 0;
  }

  get telemetrieLatitudeDisplay(): string {
    const v = this.latestTelemetrie()?.latitude;
    return v !== null && v !== undefined ? `${Number(v).toFixed(6)}°` : '—';
  }

  get telemetrieLongitudeDisplay(): string {
    const v = this.latestTelemetrie()?.longitude;
    return v !== null && v !== undefined ? `${Number(v).toFixed(6)}°` : '—';
  }

  get telemetrieMapsLink(): string {
    const t = this.latestTelemetrie();
    if (!t) return '';
    return `https://www.google.com/maps?q=${t.latitude},${t.longitude}`;
  }

  get batteryCapacityDisplay(): string {
    const v = this.batteryDiagnostic()?.capacite_restante_ah;
    return v !== null && v !== undefined ? `${Number(v).toFixed(1)} Ah` : '—';
  }

  get batteryDurationDisplay(): string {
    const v = this.batteryDiagnostic()?.duree_estimee_jours;
    return v !== null && v !== undefined ? `~${v} jours` : '—';
  }

  get batteryDateDisplay(): string {
    const raw = this.batteryDiagnostic()?.date_heure;
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return (
      d.toLocaleDateString('fr-FR') +
      ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  /**
   * Intervention de maintenance associée à cet équipement (si elle existe).
   * Utilisée par la vue détail ouverte depuis /maintenance pour afficher
   * les techniciens affectés et la planification prévue.
   */
  get maintenanceItem(): MaintenanceItem | null {
    if (!this.equipment) return null;
    return this.maintenanceService.getItems().find(i => i.equipment === this.equipment!.nom) ?? null;
  }

  /** Techniciens affectés à l'intervention de cet équipement (nom + téléphone). */
  get techniciensAffectes(): { nom: string; telephone: string }[] {
    const item = this.maintenanceItem;
    if (!item?.affectes) return [];
    return item.affectes.map(a => {
      const user =
        this.usersService.getAllUsers().find(u => u.name === a.nom) ??
        this.authService.getAllUsers().find(u => u.name === a.nom);
      return { nom: a.nom, telephone: user?.telephone ?? '' };
    });
  }

  /** Date prévue de l'intervention, formatée en français si lisible. */
  get datePrevueDisplay(): string {
    const item = this.maintenanceItem;
    const raw = item?.datePrevueISO || item?.datePrevue;
    if (!raw) return '—';
    const iso = item?.datePrevueISO ? `${raw}T00:00:00` : raw;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  retour(): void {
    switch (this.source) {
      case 'alerts':
        this.router.navigate(['/alerts']);
        break;
      case 'maintenance':
        this.router.navigate(['/maintenance']);
        break;
      default:
        this.router.navigate(['/equipements']);
    }
  }

  prendreAlerte(): void {
    if (!this.equipment) return;
    const maintenanceItems = this.maintenanceService.getItems();
    const item = maintenanceItems.find(i => i.equipment === this.equipment!.nom);
    if (item && !item.prisPar) {
      const userName = this.authService.getUser()?.name || 'Utilisateur';
      this.maintenanceService.prendreAlerte(item.id, userName);
      this.isAlertTaken = true;
    }
  }

  inspecter(): void {
    this.router.navigate(['/maintenance']);
  }
}