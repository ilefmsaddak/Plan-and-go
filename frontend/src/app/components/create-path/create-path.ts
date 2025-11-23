import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PlansService } from '../../services/plans.service';

@Component({
  selector: 'create-path',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-path.html',
  styleUrl: './create-path.scss'
})
export class CreatePathComponent {
  city = signal('istanbul');
  from = signal('2025-01-01');
  to = signal('2025-01-01');
  loading = signal(false);
  error = signal<string | null>(null);

  createPathSuccess = output<void>();
  closeModal = output<void>();
  showRegisterModal = output<void>();


  constructor(
    private planService: PlansService,
    private router: Router
  ) { }

  createPlan(): void {
    // Validation
    if (!this.city() || !this.from() || !this.to) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }


    this.loading.set(true);
    this.error.set(null);

    this.planService.createPlan({ city: this.city(), from_date: this.from(), to_date: this.to(), author_name: localStorage.getItem("username"), author_id: localStorage.getItem("user_id") }).subscribe({
      next: (response) => {
        console.log(response.data)
        if (response.id) {
          // Définir l'utilisateur courant
          localStorage.setItem("plan", response.id)
          this.createPathSuccess.emit()
          this.closeLoginModal()

        } else {
          this.error.set(response.message || 'Erreur de connexion');
          this.loading.set(false);
        }
      },
      error: (err) => {

        this.error.set('city ou mot de passe incorrect');
        this.loading.set(false);
      }
    });
  }



  closeLoginModal(): void {
    // Réinitialiser les champs
    this.city.set('');
    this.from.set('');
    this.error.set(null);
    this.loading.set(false);
    this.closeModal.emit();
  }

  goToRegister(): void {
    this.closeModal.emit();
    this.showRegisterModal.emit();
  }

  private isValidcity(city: string): boolean {
    const cityRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return cityRegex.test(city);
  }
}
