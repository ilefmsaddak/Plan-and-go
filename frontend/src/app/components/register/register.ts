import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  firstName = signal('');
  lastName = signal('');
  email = signal('');
  password = signal('');
  passwordConfirm = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  showPasswordConfirm = signal(false);

  registerSuccess = output<void>();
  closeModal = output<void>();

  constructor(private authService: AuthService) {}

  register(): void {
    // Validation
    if (!this.firstName() || !this.lastName() || !this.email() || !this.password() || !this.passwordConfirm()) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (this.firstName().length < 2) {
      this.error.set('Le nom doit contenir au moins 2 caractères');
      return;
    }

    if (this.lastName().length < 2) {
      this.error.set('Le prénom doit contenir au moins 2 caractères');
      return;
    }

    if (!this.isValidEmail(this.email())) {
      this.error.set('Email invalide');
      return;
    }

    if (this.password().length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (this.password() !== this.passwordConfirm()) {
      this.error.set('Les mots de passe ne correspondent pas');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Créer le username à partir du nom et prénom
    const username = `${this.firstName()} ${this.lastName()}`;

    this.authService.register(
      username,
      this.email(),
      this.password()
    ).subscribe({
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
          this.registerSuccess.emit();
        } else {
          this.error.set(response.message || 'Erreur d\'inscription');
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Erreur d\'inscription:', err);
        if (err.status === 400) {
          this.error.set('Cet email ou ce nom d\'utilisateur est déjà utilisé');
        } else {
          this.error.set('Erreur lors de l\'inscription');
        }
        this.loading.set(false);
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  togglePasswordConfirmVisibility(): void {
    this.showPasswordConfirm.set(!this.showPasswordConfirm());
  }

  closeRegisterModal(): void {
    this.closeModal.emit();
  }

  goToLogin(): void {
    this.closeRegisterModal();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
