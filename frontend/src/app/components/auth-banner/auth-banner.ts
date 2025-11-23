import { Component, signal, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../login/login';
import { RegisterComponent } from '../register/register';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-banner',
  standalone: true,
  imports: [CommonModule, LoginComponent, RegisterComponent],
  templateUrl: './auth-banner.html',
  styleUrl: './auth-banner.scss'
})
export class AuthBannerComponent {
  isVisible = signal(true);
  showLoginModal = signal(false);
  showRegisterModal = signal(false);

  closeBanner = output<void>();

  constructor(public authService: AuthService) {
    // Fermer la bande si l'utilisateur est connecté
    if (this.authService.currentUserId()) {
      this.isVisible.set(false);
    }

    // Mettre à jour la bannière réactivement quand l'utilisateur se connecte/déconnecte
    effect(() => {
      if (this.authService.currentUserId()) {
        this.isVisible.set(false);
      } else {
        this.isVisible.set(true);
      }
    });
  }

  onLogin(): void {
    this.showLoginModal.set(true);
  }

  onLoginSuccess(): void {
    this.showLoginModal.set(false);
    this.isVisible.set(false);
    this.closeBanner.emit();
  }

  onRegisterSuccess(): void {
    this.showRegisterModal.set(false);
    this.isVisible.set(false);
    this.closeBanner.emit();
  }

  onShowRegister(): void {
    this.showLoginModal.set(false);
    this.showRegisterModal.set(true);
  }

  onCloseRegister(): void {
    this.showRegisterModal.set(false);
    this.showLoginModal.set(true);
  }

  onCloseLogin(): void {
    this.showLoginModal.set(false);
  }

  close(): void {
    this.isVisible.set(false);
    this.closeBanner.emit();
  }
}
