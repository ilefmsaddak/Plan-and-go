import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { map, mergeMap, catchError, toArray } from 'rxjs/operators';
import { Place } from '../models/interfaces';
import { environment } from '../environment/env';

export interface PlacesSearchOptions {
  location: { lat: number; lng: number };
  radius: number;
  types?: string[];
  keyword?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlacesService {
  // La clé SerpApi ne devrait jamais être exposée au frontend
  // Elle reste stockée en backend et le proxy la gère
  private proxyUrl: string = environment.mapProxyUrl;

  // Mapping des types de filtres vers SerpApi keywords
  private typeMapping: { [key: string]: string[] } = {
    site: ['tourist attraction', 'museum', 'art gallery', 'historic site', 'monument', 'gallery', 'cultural site'],
    hotel: ['hotel', 'accommodation', 'lodging', 'guest house', 'resort'],
    food: ['restaurant', 'dining', 'bistro', 'cuisine'],
    cafe: ['cafe', 'coffee shop', 'bakery', 'pastry'],
    shop: ['shopping', 'store', 'shopping mall', 'boutique', 'market'],
    transports: ['bus station', 'subway station', 'train station', 'airport', 'parking', 'taxi']
  };

  constructor(private http: HttpClient) {}

  /**
   * Initialiser le service (pour compatibilité avec ancien code)
   */
  initializeService(map: any): void {
    console.log('✓ PlacesService initialized');
    console.log('Proxy URL:', this.proxyUrl ? '✓ Configured' : '✗ Missing');
  }

  /**
   * Rechercher des lieux par type et localisation
   */
  searchPlacesByType(
    location: { lat: number; lng: number },
    placeTypes: string[],
    radius: number = 5000
  ): Observable<Place[]> {
    if (!this.proxyUrl) {
      console.error('Proxy URL not configured');
      return throwError(() => new Error('Proxy URL not configured'));
    }

    if (placeTypes.length === 0) {
      return of([]);
    }

    // Créer une requête pour chaque type
    const keywords = placeTypes.flatMap(type => this.typeMapping[type] || []);
    const uniqueKeywords = [...new Set(keywords)];

    // Faire une recherche par keyword et combiner tous les résultats
    return from(uniqueKeywords).pipe(
      mergeMap(keyword => this.searchByKeyword(location, keyword, radius)),
      toArray(),
      map(allResultsArrays => {
        // Aplatir le tableau de tableaux
        const allResults = allResultsArrays.flat();
        // Dédupliquer par nom et coordonnées
        const seen = new Set<string>();
        return allResults.filter(place => {
          const key = `${place.name}-${place.coordinates.lat}-${place.coordinates.lng}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }),
      catchError(error => {
        console.error('Error searching places:', error);
        return of([]);
      })
    );
  }

  /**
   * Rechercher des lieux par keyword
   */
  private searchByKeyword(
    location: { lat: number; lng: number },
    keyword: string,
    radius: number
  ): Observable<Place[]> {
    return new Observable(observer => {
      const params = {
        type: 'search',
        q: `${keyword} near Istanbul`,
        ll: `${location.lat},${location.lng}`,
        radius: Math.round(radius / 1000)
      };

      
      this.http.get<any>(this.proxyUrl, { params }).subscribe({
        next: (response) => {
          if (response.places && Array.isArray(response.places)) {
            const places = response.places
              .map((item: any) => this.convertSerpApiPlace(item))
              .filter((place: Place | null): place is Place => place !== null);
            
            console.log(`✓ Found ${places.length} places for "${keyword}"`);
            observer.next(places);
          } else {
            console.warn(`⚠️ No places found for "${keyword}"`);
            observer.next([]);
          }
          observer.complete();
        },
        error: (error) => {
          console.error(`✗ Error searching for "${keyword}":`, error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  /**
   * Convertir une réponse SerpApi en objet Place avec validation Istanbul
   */
  private convertSerpApiPlace(item: any): Place | null {
    // Valider les coordonnées strictement pour Istanbul
    const lat = parseFloat(item.latitude);
    const lng = parseFloat(item.longitude);

    // Istanbul bounds: lat ~40.77 to ~41.26, lng ~28.69 to ~29.43
    // Ajouter une petite marge de sécurité
    if (!isFinite(lat) || !isFinite(lng) || 
        lat < 40.7 || lat > 41.3 || 
        lng < 28.6 || lng > 29.5) {
      console.warn(`⚠️ Skipping "${item.title}": coordinates [${lat}, ${lng}] are outside Istanbul`);
      return null;
    }

    // Détecter le type basé sur le titre/description
    const type = this.detectPlaceType(item.title, item.description || '');

    return {
      placeId: item.place_id || `${item.title}-${item.latitude}-${item.longitude}`,
      name: item.title || 'Unnamed Place',
      address: item.address || item.description || 'Address not available',
      coordinates: {
        lat: lat,
        lng: lng
      },
      rating: item.rating ? Math.round(parseFloat(item.rating)) : 0,
      reviews: item.review_count || 0,
      type: type as 'site' | 'hotel' | 'food' | 'cafe' | 'shop' | 'transports',
      photos: item.image ? [item.image] : [],
      phoneNumber: item.phone || ''
    };
  }

  /**
   * Détecter le type de place basé sur le titre et la description
   */
  private detectPlaceType(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();

    for (const [type, keywords] of Object.entries(this.typeMapping)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return type;
        }
      }
    }

    return 'site';
  }

  /**
   * Récupérer les photos additionnelles d'un lieu
   */
  getPlacePhotos(placeId: string): Observable<string[]> {
    return new Observable(observer => {
      const params = {
        type: 'place',
        place_id: placeId
      };

      this.http.get<any>(this.proxyUrl, { params }).subscribe({
        next: (response) => {
          const photos: string[] = [];
          if (response.photos && Array.isArray(response.photos)) {
            photos.push(...response.photos.map((p: any) => p.image || p));
          }
          observer.next(photos);
          observer.complete();
        },
        error: () => {
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  /**
   * Obtenir l'icon emoji basé sur le type
   */
  getPlaceIcon(type: string): string {
    const icons: { [key: string]: string } = {
      site: '📷',
      hotel: '🏨',
      food: '🍽️',
      cafe: '☕',
      shop: '🛍️',
      transports: '🚌'
    };
    return icons[type] || '📍';
  }

  /**
   * Obtenir la couleur du marqueur basé sur le type
   */
  getMarkerColor(type: string): string {
    const colors: { [key: string]: string } = {
      site: '#4285f4',      // Blue
      hotel: '#34a853',     // Green
      food: '#fbbc05',      // Yellow
      cafe: '#ea4335',      // Red
      shop: '#f39c12',      // Orange
      transports: '#ff6d00' // Deep Orange
    };
    return colors[type] || '#667eea';
  }
}
