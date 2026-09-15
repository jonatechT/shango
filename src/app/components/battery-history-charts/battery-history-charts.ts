import { Component, Input, OnChanges, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BatteryHistoryEntry } from '../../services/equipment.service';

Chart.register(...registerables);

/**
 * Graphiques d'historique batterie (Chart.js) :
 *  - Évolution du SOH      (graphique principal, pleine largeur)
 *  - Évolution de la capacité
 *  - Évolution de la température
 *
 * Les données proviennent exclusivement du backend via `EquipmentService`
 * (GET /api/batterie/{device_id}/historique) — aucune donnée fictive ici.
 */
@Component({
  selector: 'app-battery-history-charts',
  standalone: true,
  template: `
<div class="bhc-grid">
      <!-- Graphique principal : SOH -->
      <div class="bhc-card bhc-card--main">
        <div class="bhc-head">
          <span class="bhc-chip bhc-chip--blue"><i class="fa-solid fa-heart-pulse"></i></span>
          <div class="bhc-title-block">
            <h4 class="bhc-title">Évolution du SOH</h4>
            <span class="bhc-sub">État de santé de la batterie (%)</span>
          </div>
        </div>
        <div class="bhc-chart-box">
          <canvas #sohCanvas></canvas>
        </div>
      </div>

      <!-- Capacité -->
      <div class="bhc-card">
        <div class="bhc-head">
          <span class="bhc-chip bhc-chip--green"><i class="fa-solid fa-database"></i></span>
          <div class="bhc-title-block">
            <h4 class="bhc-title">Évolution de la capacité</h4>
            <span class="bhc-sub">Capacité restante (Ah)</span>
          </div>
        </div>
        <div class="bhc-chart-box">
          <canvas #capaciteCanvas></canvas>
        </div>
      </div>

      <!-- Température -->
      <div class="bhc-card">
        <div class="bhc-head">
          <span class="bhc-chip bhc-chip--red"><i class="fa-solid fa-temperature-half"></i></span>
          <div class="bhc-title-block">
            <h4 class="bhc-title">Évolution de la température</h4>
            <span class="bhc-sub">Température mesurée (°C)</span>
          </div>
        </div>
        <div class="bhc-chart-box">
          <canvas #temperatureCanvas></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
:host { display: block; width: 100%; min-width: 0; }
      .bhc-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        width: 100%;
        min-width: 0;
      }
      .bhc-card {
        background: #FFFFFF;
        border: 1px solid rgba(23, 32, 51, 0.06);
        border-radius: 18px;
        padding: 18px 20px;
        box-shadow: 0 8px 30px rgba(65, 78, 120, 0.08);
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .bhc-card--main { grid-column: 1 / -1; }
      .bhc-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .bhc-chip {
        width: 40px; height: 40px; border-radius: 12px;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 16px; flex-shrink: 0;
      }
      .bhc-chip--blue { background: rgba(37, 99, 235, 0.12); color: #2563EB; }
      .bhc-chip--green { background: rgba(32, 201, 151, 0.14); color: #12B886; }
      .bhc-chip--red { background: rgba(239, 68, 68, 0.12); color: #EF4444; }
      .bhc-title-block { min-width: 0; }
      .bhc-title { margin: 0; font-size: 15px; font-weight: 700; color: #172033; }
      .bhc-sub { font-size: 12px; color: #7A8499; }
      .bhc-chart-box {
        position: relative;
        width: 100%;
        min-width: 0;
        height: 230px;
      }
      .bhc-chart-box canvas { display: block; width: 100% !important; height: 100% !important; }

      @media (max-width: 768px) {
        .bhc-grid { grid-template-columns: 1fr; }
        .bhc-card--main { grid-column: auto; }
        .bhc-chart-box { height: 210px; }
      }
      @media (max-width: 420px) {
        .bhc-chart-box { height: 190px; }
        .bhc-card { padding: 14px; }
      }
    `
  ]
})
export class BatteryHistoryChartsComponent implements OnChanges, AfterViewInit, OnDestroy {
@Input() history: BatteryHistoryEntry[] = [];

  @ViewChild('sohCanvas') sohCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('capaciteCanvas') capaciteCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('temperatureCanvas') temperatureCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  /** Les canvas (@ViewChild) ne sont résolus qu'après ngAfterViewInit. Si ce
   * composant est créé avec des données déjà présentes (cf. @if côté parent),
   * ngOnChanges peut s'exécuter avant : on ignore ce premier appel et on
   * laisse ngAfterViewInit faire le rendu initial. */
  private viewReady = false;

  constructor(private ngZone: NgZone) {}

  ngOnChanges(): void {
    if (!this.viewReady) return;
    this.renderCharts();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  /** Image PNG de la courbe SOH (utilisée dans le rapport PDF). */
  getSohChartImageDataUrl(): string | null {
    const canvas = this.sohCanvas?.nativeElement;
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  private renderCharts(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const html = this.history ?? [];
    this.destroyCharts();
    if (html.length === 0) return;
    const labels = html.map(e => this.formatLabel(e.date_heure));
    this.charts.push(
      this.createChart(this.sohCanvas, this.buildSohConfig(labels, html)),
      this.createChart(this.capaciteCanvas, this.buildCapaciteConfig(labels, html)),
      this.createChart(this.temperatureCanvas, this.buildTemperatureConfig(labels, html))
    );
  }

  private createChart(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined,
    config: ChartConfiguration<'line'>
  ): Chart<'line'> {
    if (!canvasRef?.nativeElement) {
      throw new Error('Canvas batterie introuvable');
    }
    const ctx = canvasRef.nativeElement.getContext('2d');
    if (!ctx) {
      throw new Error('Contexte canvas 2D indisponible');
    }
    return this.ngZone.runOutsideAngular(() => new Chart(ctx, config));
  }

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private buildSohConfig(labels: string[], history: BatteryHistoryEntry[]): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'SOH (%)',
            data: history.map(e => e.soh),
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            pointBackgroundColor: '#2563EB',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => `SOH : ${Number(item.raw).toFixed(1)} %` } }
        },
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { callback: value => `${value} %`, font: { size: 11 } },
            grid: { color: 'rgba(15, 23, 42, 0.06)' }
          },
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    };
  }

  private buildCapaciteConfig(labels: string[], history: BatteryHistoryEntry[]): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Capacité (Ah)',
            data: history.map(e => e.capacite),
            borderColor: '#12B886',
            backgroundColor: 'rgba(32, 201, 151, 0.12)',
            pointBackgroundColor: '#12B886',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => `Capacité : ${Number(item.raw).toFixed(1)} Ah` } }
        },
        scales: {
          y: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(15, 23, 42, 0.06)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    };
  }

  private buildTemperatureConfig(labels: string[], history: BatteryHistoryEntry[]): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Température (°C)',
            data: history.map(e => e.temperature),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.10)',
            pointBackgroundColor: '#EF4444',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            spanGaps: true
          },
          {
            label: 'Seuil 45 °C',
            data: history.map(() => 45),
            borderColor: 'rgba(239, 68, 68, 0.55)',
            borderDash: [6, 6],
            borderWidth: 1,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => `Température : ${Number(item.raw).toFixed(1)} °C` } }
        },
        scales: {
          y: { ticks: { callback: value => `${value} °C`, font: { size: 11 } }, grid: { color: 'rgba(15, 23, 42, 0.06)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    };
  }

  private formatLabel(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }
}