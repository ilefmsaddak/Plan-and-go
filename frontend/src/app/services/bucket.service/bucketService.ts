import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';


export interface FavoritePlace {
  id: string;
  name: string;
  type: string;
  coordinates?: { lat: number; lng: number };
}
export interface DayPlan {
  date: string;
  temp: string;
  places: FavoritePlace[];
}
@Injectable({
  providedIn: 'root',
})


export class BucketService {
   private apiUrl = 'http://127.0.0.1:8000/bucket';
  private readonly FAVORITES_KEY = 'bucket_favorites';
  private readonly DAYS_KEY = 'bucket_days';

private favoritesSubject = new BehaviorSubject<FavoritePlace[]>([]);
  favorites$ = this.favoritesSubject.asObservable();
  constructor(private http: HttpClient) {
    // Load persisted favorites on service init
    const loaded = this.loadFavorites();
    if (loaded) {
      this.favoritesSubject.next(loaded);
    }
  }

 addToFavorites(place: FavoritePlace) {
    const current = [...this.favoritesSubject.value];
    // Avoid duplicates by id
    if (!current.find(p => p.id === place.id)) {
      current.push(place);
      this.favoritesSubject.next(current);
      this.saveFavorites(current);
    }


  }

removeFavorite(place: FavoritePlace) {
  const current = [...this.favoritesSubject.value];
  const index = current.indexOf(place); // find exact object reference
  if (index > -1) {
    current.splice(index, 1); // remove just that one instance
    this.favoritesSubject.next(current);
    this.saveFavorites(current);
  }
}

  setFavorites(favorites: FavoritePlace[]) {
    this.favoritesSubject.next([...favorites]);
    this.saveFavorites(favorites);
  }

  private saveFavorites(favorites: FavoritePlace[]): void {
    try {
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  }

  private loadFavorites(): FavoritePlace[] | null {
    try {
      const raw = localStorage.getItem(this.FAVORITES_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as FavoritePlace[];
      return null;
    } catch (e) {
      console.warn('Failed to parse favorites from localStorage', e);
      return null;
    }
  }

  saveDays(days: DayPlan[]): void {
    try {
      localStorage.setItem(this.DAYS_KEY, JSON.stringify(days));
    } catch (e) {
      console.error('Failed to save days to localStorage', e);
    }
  }

  getSavedDays(): DayPlan[] | null {
    try {
      const raw = localStorage.getItem(this.DAYS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DayPlan[];
      return null;
    } catch (e) {
      console.warn('Failed to parse days from localStorage', e);
      return null;
    }
  }



  saveItinerary(days: DayPlan[], tripId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/add/`, { tripId, days });
  }
}
