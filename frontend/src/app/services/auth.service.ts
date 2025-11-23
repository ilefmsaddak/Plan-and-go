import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal, computed } from '@angular/core';
import { Observable } from 'rxjs';

export interface User {
  userId: string;
  username: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  userId?: string;
  username?: string;
  email?: string;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  // Signaux pour l'état d'authentification
  currentUserId = signal<string | null>(null);
  currentUsername = signal<string | null>(null);
  currentUserEmail = signal<string | null>(null);
  isAuthenticated = signal(false);
  accessToken = signal<string | null>(null);

  // Computed pour vérifier l'authentification
  isLoggedIn = computed(() => !!this.currentUserId());

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  /**
   * Connexion utilisateur
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login/`, {
      email,
      password
    });
  }

  /**
   * Inscription utilisateur
   */
  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register/`, {
      username,
      email,
      password
    });
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.currentUserId.set(null);
    this.currentUsername.set(null);
    this.currentUserEmail.set(null);
    this.isAuthenticated.set(false);
    this.accessToken.set(null);
    localStorage.clear();
  }

  /**
   * Définir l'utilisateur courant
   */
  setCurrentUser(userId: string, username: string, email: string, token?: string): void {
    this.currentUserId.set(userId);
    this.currentUsername.set(username);
    this.currentUserEmail.set(email);
    this.isAuthenticated.set(true);
    
    if (token) {
      this.accessToken.set(token);
      localStorage.setItem('access_token', token);
    }

    // Sauvegarder dans localStorage
    localStorage.setItem('user_id', userId);
    localStorage.setItem('username', username);
    localStorage.setItem('email', email);
  }

  /**
   * Charger l'utilisateur depuis localStorage
   */
  private loadFromStorage(): void {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const email = localStorage.getItem('email');
    const token = localStorage.getItem('access_token');

    if (userId && username && email) {
      this.currentUserId.set(userId);
      this.currentUsername.set(username);
      this.currentUserEmail.set(email);
      this.isAuthenticated.set(true);
      
      if (token) {
        this.accessToken.set(token);
      }
    }
  }

  /**
   * Récupérer le profil utilisateur
   */
  getUserProfile(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/profile/${userId}/`);
  }

  /**
   * Mettre à jour le profil utilisateur
   */
  updateUserProfile(userId: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile/${userId}/`, data);
  }
}
