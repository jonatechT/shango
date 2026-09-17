import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  identifier = signal('');
  password = signal('');
  showPassword = signal(false);
  rememberMe = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.errorMessage.set('');
    if (!this.identifier() || !this.password()) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return;
    }
    // Validation du format e-mail : doit contenir « @ » puis un domaine se terminant par « .com ».
    const id = this.identifier().trim();
    if (!/^[^@\s]+@[^@\s]*\.com$/i.test(id)) {
      this.errorMessage.set('Veuillez saisir une adresse e-mail valide (ex. nom@domaine.com).');
      return;
    }
    this.isLoading.set(true);
    this.authService.login(id, this.password()).subscribe(result => {
      this.isLoading.set(false);
      if (result.success) {
        const user = this.authService.getUser();
        if (user?.role === 'SUPERADMIN') {
          this.router.navigate(['/superadmin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else if (result.pending) {
        // Compte en attente de validation admin : accès bloqué
        this.router.navigate(['/pending']);
      } else {
        this.errorMessage.set(result.message || 'Identifiants incorrects.');
      }
    });
  }
}
