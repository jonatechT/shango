import { Component, Input, OnChanges, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BatteryHistoryEntry } from '../../services/equipment.service';

Chart.register(...registerables);

/** Seuil de surchauffe (°C) — identique au backend (BatterieCalculService). */
const SEUIL_SURCHAUFFE_C = 45;

/**
 * Courbes d'historique batterie (Chart.js) — document 3 §10 :
 *   1. SOH (%) dans le temps (la plus importante) + capacité restante (Ah)
 *   2. Température, avec le seuil de surchauffe, pour repérer les épisodes
 *
 * Les données proviennent exclusivement du backend via `EquipmentService`
 * (GET /api/batteries/{device_id}/diagnostics), triées du plus ancien au plus
 * récent — aucune donnée fictive ici.
 */
@Component({
  selector: 'app-battery-history-charts',
  standalone: true,
  template: `
    <div class="bhc-summary">
      <span>{{ history.length }} diagnostic{{ history.length > 1 ? 's' : '' }} enregistré{{ history.length > 1 ? 's' : '' }}</span>
      @if (sohTrend !== null) {
        <span [class.bhc-down]="sohTrend < 0">
          Tendance SOH : {{ sohTrend > 0 ? '+' : '' }}{{ sohTrend.toFixed(1) }} pts depuis le premier diagnostic
        </span>
      }
      @if (overheatCount > 0) {
        <span class="bhc-down">{{ overheatCount }} épisode{{ overheatCount > 1 ? 's' : '' }} de surchauffe (&gt; 45 °C)</span>
      }
    </div>
    <h4 class="bhc-title">SOH (%) et capacité restante (Ah)</h4>
    <div class="bhc-chart-box">
      <canvas #sohCanvas></canvas>
    </div>
    <h4 class="bhc-title">Température (°C)</h4>
    <div class="bhc-chart-box bhc-chart-box--small">
      <canvas #tempCanvas></canvas>
    </div>
  `,
  styles: [
    `
:host { display: block; width: 100%; min-width: 0; }
      .bhc-summary {
        display: flex; flex-wrap: wrap; gap: 6px 16px;
        font-size: 12.5px; color: #475569; margin-bottom: 10px;
      }
      .bhc-down { color: #B91C1C; font-weight: 600; }
      .bhc-title { font-size: 13px; font-weight: 600; color: #334155; margin: 12px 0 6px; }
      .bhc-chart-box {
        position: relative;
        width: 100%;
        min-width: 0;
        height: 260px;
      }
      .bhc-chart-box--small { height: 180px; }
      .bhc-chart-box canvas { display: block; width: 100% !important; height: 100% !important; }

      @media (max-width: 768px) {
        .bhc-chart-box { height: 220px; }
        .bhc-chart-box--small { height: 160px; }
      }
      @media (max-width: 420px) {
        .bhc-chart-box { height: 190px; }
        .bhc-chart-box--small { height: 150px; }
      }
    `
  ]
})
export class BatteryHistoryChartsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() history: BatteryHistoryEntry[] = [];

  @ViewChild('sohCanvas') sohCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tempCanvas') tempCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: Chart<'line'>[] = [];
  /** Les canvas (@ViewChild) ne sont résolus qu'après ngAfterViewInit. Si ce
   * composant est créé avec des données déjà présentes (cf. @if côté parent),
   * ngOnChanges peut s'exécuter avant : on ignore ce premier appel et on
   * laisse ngAfterViewInit faire le rendu initial. */
  private viewReady = false;

  constructor(private ngZone: NgZone) {}

  /** Écart de SOH (points) entre le premier et le dernier diagnostic — tendance de vieillissement. */
  get sohTrend(): number | null {
    const values = (this.history ?? []).map(e => e.soh).filter((v): v is number => v !== null && v !== undefined);
    if (values.length < 2) return null;
    return values[values.length - 1] - values[0];
  }

  get overheatCount(): number {
    return (this.history ?? []).filter(e => e.temperature !== null && e.temperature !== undefined && e.temperature > SEUIL_SURCHAUFFE_C).length;
  }

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
    const history = this.history ?? [];
    this.destroyCharts();
    if (history.length === 0) return;
    const labels = history.map(e => this.formatLabel(e.date_heure));
    this.charts.push(this.createChart(this.sohCanvas, this.buildSohConfig(labels, history)));
    this.charts.push(this.createChart(this.tempCanvas, this.buildTemperatureConfig(labels, history)));
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
            yAxisID: 'y',
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            pointBackgroundColor: '#2563EB',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            spanGaps: true
          },
          {
            label: 'Capacité (Ah)',
            data: history.map(e => e.capacite),
            yAxisID: 'y1',
            borderColor: '#059669',
            backgroundColor: '#059669',
            pointRadius: 2,
            pointHoverRadius: 4,
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.35,
            fill: false,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: item =>
                item.dataset.yAxisID === 'y1'
                  ? `Capacité : ${Number(item.raw).toFixed(1)} Ah / 24`
                  : `SOH : ${Number(item.raw).toFixed(1)} %`
            }
          }
        },
        scales: {
          y: {
            position: 'left',
            suggestedMin: 50,
            max: 100,
            ticks: { callback: value => `${value} %`, font: { size: 11 } },
            grid: { color: 'rgba(15, 23, 42, 0.06)' }
          },
          // Échelle alignée sur le SOH : 24 Ah = 100 %, 12 Ah = 50 %.
          y1: {
            position: 'right',
            suggestedMin: 12,
            max: 24,
            ticks: { callback: value => `${value} Ah`, font: { size: 11 } },
            grid: { display: false }
          },
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    };
  }

  private buildTemperatureConfig(labels: string[], history: BatteryHistoryEntry[]): ChartConfiguration<'line'> {
    const temperatures = history.map(e => e.temperature);
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Température (°C)',
            data: temperatures,
            borderColor: '#EA580C',
            backgroundColor: 'rgba(234, 88, 12, 0.10)',
            pointBackgroundColor: temperatures.map(t => (t !== null && t > SEUIL_SURCHAUFFE_C ? '#DC2626' : '#EA580C')),
            pointRadius: temperatures.map(t => (t !== null && t > SEUIL_SURCHAUFFE_C ? 5 : 3)),
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            spanGaps: true
          },
          {
            label: `Seuil surchauffe (${SEUIL_SURCHAUFFE_C} °C)`,
            data: labels.map(() => SEUIL_SURCHAUFFE_C),
            borderColor: '#DC2626',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: item => `${item.dataset.label} : ${Number(item.raw).toFixed(1)} °C` } }
        },
        scales: {
          y: {
            suggestedMin: 15,
            suggestedMax: 50,
            ticks: { callback: value => `${value} °C`, font: { size: 11 } },
            grid: { color: 'rgba(15, 23, 42, 0.06)' }
          },
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
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  }
}
