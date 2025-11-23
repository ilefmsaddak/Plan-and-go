import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  loginSuccess = output<void>();
  closeModal = output<void>();
  showRegisterModal = output<void>();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    // Validation
    if (!this.email() || !this.password()) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (!this.isValidEmail(this.email())) {
      this.error.set('Email invalide');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.email(), this.password()).subscribe({
      next: (response) => {
        if (response.success && response.userId && response.username && response.email) {
          // Définir l'utilisateur courant
          this.authService.setCurrentUser(
            response.userId,
            response.username,
            response.email,
            response.token
          );

          this.loading.set(false);
          this.loginSuccess.emit();
          // Rediriger vers la page d'accueil après connexion réussie
          this.router.navigate(['/']);
        } else {
          this.error.set(response.message || 'Erreur de connexion');
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Erreur de connexion:', err);
        this.error.set('Email ou mot de passe incorrect');
        this.loading.set(false);
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  closeLoginModal(): void {
    // Réinitialiser les champs
    this.email.set('');
    this.password.set('');
    this.error.set(null);
    this.showPassword.set(false);
    this.loading.set(false);
    // Naviguer vers la page d'accueil
    this.router.navigate(['/']);
  }

  goToRegister(): void {
    this.closeModal.emit();
    this.showRegisterModal.emit();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
