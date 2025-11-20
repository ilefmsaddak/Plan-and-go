import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { map, mergeMap, catchError, toArray } from 'rxjs/operators';
import { Place } from '../models/interfaces';

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
  private service: google.maps.places.PlacesService | null = null;
  private map: google.maps.Map | null = null;

  // Mapping des types de filtres vers Google Places types
  private typeMapping: { [key: string]: string[] } = {
    site: ['tourist_attraction', 'point_of_interest', 'museum', 'art_gallery'],
    hotel: ['lodging', 'hotel'],
    food: ['restaurant'],
    cafe: ['cafe', 'bakery'],
    shop: ['shopping_mall', 'store', 'clothing_store'],
    transports: ['bus_station', 'subway_station', 'train_station', 'transit_station', 'airport', 'parking']
  };

  constructor() {}

  /**
   * Initialiser le service avec une map Google
   */
  initializeService(map: google.maps.Map): void {
    this.map = map;
    this.service = new google.maps.places.PlacesService(map);
  }

  /**
   * Rechercher des lieux par type et localisation
   */
  searchPlacesByType(
    location: { lat: number; lng: number },
    placeTypes: string[],
    radius: number = 5000
  ): Observable<Place[]> {
    if (!this.service || !this.map) {
      console.error('PlacesService not initialized. Call initializeService first.');
      return throwError(() => new Error('PlacesService not initialized. Call initializeService first.'));
    }

    // Si pas de types sélectionnés, retourner vide
    if (placeTypes.length === 0) {
      return of([]);
    }

    // Créer une requête pour chaque type
    const requests = placeTypes.flatMap(type => this.typeMapping[type] || []);
    
    // Eliminer les doublons
    const uniqueRequests = [...new Set(requests)];

    // Faire une recherche par type et combiner tous les résultats
    return from(uniqueRequests).pipe(
      mergeMap(placeType => this.searchByPlaceType(location, placeType, radius)),
      toArray(),
      map(allResultsArrays => {
        // Aplatir le tableau de tableaux
        const allResults = allResultsArrays.flat();
        // Dédupliquer par nom et latitude/longitude
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
   * Rechercher des lieux par un seul type
   */
  private searchByPlaceType(
    location: { lat: number; lng: number },
    placeType: string,
    radius: number
  ): Observable<Place[]> {
    return new Observable(observer => {
      if (!this.service || !this.map) {
        observer.next([]);
        observer.complete();
        return;
      }

      const request: any = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        type: placeType
      };

      this.service.nearbySearch(
        request as any,
        (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            const places = results.map(result => this.convertPlaceResult(result)).filter(p => p !== null) as Place[];
            observer.next(places);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            observer.next([]);
          } else {
            console.warn(`Places search status: ${status}`);
            observer.next([]);
          }
          observer.complete();
        }
      );
    });
  }

  /**
   * Convertir un Google Places result en notre interface Place
   */
  private convertPlaceResult(result: google.maps.places.PlaceResult): Place | null {
    if (!result.geometry || !result.geometry.location) {
      return null;
    }

    const type = this.detectPlaceType(result);
    
    // Filter out places that don't match any category
    if (type === null) {
      return null;
    }

    return {
      name: result.name || 'Unknown',
      address: result.vicinity || result.formatted_address || 'Address not available',
      rating: result.rating || 0,
      reviews: result.user_ratings_total || 0,
      type: type,
      coordinates: {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng()
      },
      placeId: result.place_id,
      photos: result.photos?.map(photo => photo.getUrl({ maxWidth: 400, maxHeight: 400 })) || [],
      openingHours: result.opening_hours?.weekday_text || []
    };
  }

  /**
   * Détecter le type de lieu basé sur types Google ET le nom du lieu
   */
  private detectPlaceType(result: google.maps.places.PlaceResult): 'site' | 'hotel' | 'food' | 'cafe' | 'shop' | 'transports' | null {
    const types = result.types || [];
    const name = (result.name || '').toLowerCase();
    const vicinity = (result.vicinity || '').toLowerCase();
    
    // Keywords to search in name/description
    const hotelKeywords = ['hotel', 'motel', 'resort', 'inn', 'lodge', 'riad', 'guest house', 'pension', 'auberge', 'hébergement', 'accommodation'];
    const cafeKeywords = ['café', 'cafe', 'coffee', 'bakery', 'boulangerie', 'pastry', 'pâtisserie', 'kahvesi'];
    const foodKeywords = ['restaurant', 'pizzeria', 'bistro', 'grill', 'steakhouse', 'cuisine', 'diner', 'eatery', 'cantine', 'traiteur'];
    const transportsKeywords = ['bus', 'métro', 'metro', 'train', 'gare', 'station', 'tramway', 'aéroport', 'airport', 'ferry', 'transport', 'transit', 'parking', 'otopark', 'otoparki', 'taxi'];
    const shopKeywords = ['shop', 'store', 'mall', 'boutique', 'magasin', 'market', 'center commercial', 'shopping'];
    const siteKeywords = ['museum', 'musée', 'mosque', 'mosquée', 'church', 'église', 'garden', 'jardin', 'parc', 'monument', 'palace', 'château', 'fort', 'fortress', 'zoo', 'aquarium', 'gallery', 'galerie', 'temple', 'historic', 'archaeological', 'site touristique', 'attraction', 'tourisme'];
    
    // Helper function to check if name contains keywords
    const containsKeywords = (keywords: string[]): boolean => {
      return keywords.some(keyword => name.includes(keyword) || vicinity.includes(keyword));
    };
    
    // Priority 1: Check Google Places types FIRST (most reliable)
  
    // Check for hotel
    if (types.some(t => ['lodging', 'hotel', 'bed_breakfast', 'accommodation'].includes(t))) {
      return 'hotel';
    }

    // Check for transports FIRST (parking, station, etc.)
    if (types.some(t => ['bus_station', 'subway_station', 'train_station', 'transit_station', 'airport', 'parking', 'ferry_terminal'].includes(t))) {
      return 'transports';
    }
    // Check for cafe
    if (types.some(t => ['cafe', 'bakery', 'coffee_shop'].includes(t))) {
      return 'cafe';
    }
    // Check for food/restaurant
    if (types.some(t => ['restaurant', 'meal_delivery', 'meal_takeaway', 'food'].includes(t))) {
      return 'food';
    }
    // Check for shop
    if (types.some(t => ['shopping_mall', 'store', 'clothing_store', 'shoe_store', 'jewelry_store', 'department_store', 'shopping'].includes(t))) {
      return 'shop';
    }
    // Check for tourist site (LAST, because point_of_interest is too broad)
    if (types.some(t => ['tourist_attraction', 'museum', 'art_gallery', 'monument', 'zoo', 'place_of_worship'].includes(t))) {
      return 'site';
    }
    
    // Priority 2: Check name for specific keywords as fallback
    if (containsKeywords(hotelKeywords)) {
      return 'hotel';
    }
    if (containsKeywords(transportsKeywords)) {
      return 'transports';
    }
    if (containsKeywords(cafeKeywords)) {
      return 'cafe';
    }
    if (containsKeywords(foodKeywords)) {
      return 'food';
    }
    if (containsKeywords(shopKeywords)) {
      return 'shop';
    }
    if (containsKeywords(siteKeywords)) {
      return 'site';
    }

    // No match found - return null to filter out
    return null;
  }

  /**
   * Récupérer les détails complets d'un lieu
   */
  getPlaceDetails(placeId: string): Observable<any> {
    return new Observable(observer => {
      if (!this.service) {
        observer.next(null);
        observer.complete();
        return;
      }

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: ['name', 'rating', 'review', 'photos', 'opening_hours', 'formatted_phone_number', 'website', 'formatted_address']
      };

      this.service.getDetails(request, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          observer.next(result);
        } else {
          console.warn(`Place details status: ${status}`);
          observer.next(null);
        }
        observer.complete();
      });
    });
  }

  /**
   * Récupérer les photos alternatives d'un lieu
   */
  getPlacePhotos(placeId: string): Observable<string[]> {
    return new Observable(observer => {
      if (!this.service) {
        observer.next([]);
        observer.complete();
        return;
      }

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: ['photos']
      };

      this.service.getDetails(request, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result && result.photos) {
          const photoUrls = result.photos.map(photo => photo.getUrl({ maxWidth: 400, maxHeight: 400 }));
          observer.next(photoUrls);
        } else {
          observer.next([]);
        }
        observer.complete();
      });
    });
  }

  /**
   * Rechercher par texte (pour future implémentation)
   */
  searchPlacesByText(query: string, location: { lat: number; lng: number }, radius: number = 5000): Observable<Place[]> {
    return new Observable(observer => {
      if (!this.service) {
        observer.next([]);
        observer.complete();
        return;
      }

      const request: any = {
        query: query,
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: radius
      };

      this.service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places = results.map(result => this.convertPlaceResult(result)).filter(p => p !== null) as Place[];
          observer.next(places);
        } else {
          observer.next([]);
        }
        observer.complete();
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
      drinks: '🍹'
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
      drinks: '#8e44ad'     // Purple
    };
    return colors[type] || '#667eea';
  }
}
