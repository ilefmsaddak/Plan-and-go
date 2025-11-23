import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';


export interface FavoritePlace {
  id: string;
  name: string;
  type: string;
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
private favoritesSubject = new BehaviorSubject<FavoritePlace[]>([]);
  favorites$ = this.favoritesSubject.asObservable();
  constructor(private http: HttpClient) {}

 addToFavorites(place: FavoritePlace) {
    const current = this.favoritesSubject.value;
    this.favoritesSubject.next([...current, place]);


  }

removeFavorite(place: FavoritePlace) {
  const current = [...this.favoritesSubject.value];
  const index = current.indexOf(place); // find exact object reference
  if (index > -1) {
    current.splice(index, 1); // remove just that one instance
    this.favoritesSubject.next(current);
  }
}




  saveItinerary(days: DayPlan[], tripId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/add/`, { tripId, days });
  }
}
