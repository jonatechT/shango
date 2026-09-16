import { Component, Input, OnChanges, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BatteryHistoryEntry } from '../../services/equipment.service';

Chart.register(...registerables);

/**
 * Graphique d'historique batterie (Chart.js) : évolution du SOH.
 *
 * Les données proviennent exclusivement du backend via `EquipmentService`
 * (GET /api/batterie/{device_id}/historique) — aucune donnée fictive ici.
 */
@Component({
  selector: 'app-battery-history-charts',
  standalone: true,
  template: `
    <div class="bhc-chart-box">
      <canvas #sohCanvas></canvas>
    </div>
  `,
  styles: [
    `
:host { display: block; width: 100%; min-width: 0; }
      .bhc-chart-box {
        position: relative;
        width: 100%;
        min-width: 0;
        height: 260px;
      }
      .bhc-chart-box canvas { display: block; width: 100% !important; height: 100% !important; }

      @media (max-width: 768px) {
        .bhc-chart-box { height: 220px; }
      }
      @media (max-width: 420px) {
        .bhc-chart-box { height: 190px; }
      }
    `
  ]
})
export class BatteryHistoryChartsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() history: BatteryHistoryEntry[] = [];

  @ViewChild('sohCanvas') sohCanvas?: ElementRef<HTMLCanvasElement>;

  private chart: Chart<'line'> | null = null;
  /** Les canvas (@ViewChild) ne sont résolus qu'après ngAfterViewInit. Si ce
   * composant est créé avec des données déjà présentes (cf. @if côté parent),
   * ngOnChanges peut s'exécuter avant : on ignore ce premier appel et on
   * laisse ngAfterViewInit faire le rendu initial. */
  private viewReady = false;

  constructor(private ngZone: NgZone) {}

  ngOnChanges(): void {
    if (!this.viewReady) return;
    this.renderChart();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
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

  private renderChart(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const history = this.history ?? [];
    this.destroyChart();
    if (history.length === 0) return;
    const labels = history.map(e => this.formatLabel(e.date_heure));
    this.chart = this.createChart(this.sohCanvas, this.buildSohConfig(labels, history));
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

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
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

  private formatLabel(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }
}
