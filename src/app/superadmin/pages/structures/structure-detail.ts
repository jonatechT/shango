import { Component, OnInit, effect, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Structure } from '../../models/structure.model';
import { StructureService } from '../../services/structure.service';

@Component({
  selector: 'app-structure-detail',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './structure-detail.html',
  styleUrl: '../../superadmin-styles.scss'
})
export class StructureDetailComponent implements OnInit {
  protected structureId = '';
  protected structure = signal<Structure | null>(null);
  protected message = signal('');
  protected messageType = signal<'success' | 'error'>('success');
  protected showConfirmModal = signal(false);

  constructor(
    private structureService: StructureService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Réagit au chargement (async) de la liste des structures : si le
    // composant est monté avant la fin du premier GET /api/organizations
    // (ex. accès direct à l'URL), la fiche se remplit dès que les données
    // arrivent au lieu de rester vide.
    effect(() => {
      const s = this.structureService.structures().find(item => item.id === this.structureId);
      if (s) this.structure.set(s);
    });
  }

  ngOnInit(): void {
    this.structureId = this.route.snapshot.paramMap.get('id') || '';
    const s = this.structureService.getStructure(this.structureId);
    if (s) this.structure.set(s);
    this.structureService.load();
  }

  protected confirmToggleStatus(): void {
    this.showConfirmModal.set(true);
  }

  protected cancelModal(): void {
    this.showConfirmModal.set(false);
  }

  protected confirmToggle(): void {
    const s = this.structure();
    if (!s) return;
    this.structureService.toggleStatus(s.id).subscribe(updated => {
      if (updated) {
        const action = updated.statut === 'ACTIVE' ? 'activée' : 'désactivée';
        this.structure.set(updated);
        this.message.set(`La structure « ${updated.nom} » a été ${action} avec succès.`);
        this.messageType.set('success');
        setTimeout(() => this.message.set(''), 4000);
      } else {
        this.message.set(this.structureService.error() || 'Une erreur est survenue.');
        this.messageType.set('error');
      }
    });
    this.cancelModal();
  }
}