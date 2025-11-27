import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../environment/env';

/* -------------------------------------------------------
   DATA MODELS
------------------------------------------------------- */

export type LatLng = [number, number]; // [lat, lon]
export type LonLat = [number, number]; // [lon, lat]

export interface RouteInstruction {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  wayName?: string;
}

export interface RouteSegment {
  distance: number;
  duration: number;
}

export interface RouteBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface RouteResponse {
  routeCoordinates: LatLng[];
  totalDistance: number;
  totalDuration: number;
  instructions: RouteInstruction[];
  segments?: RouteSegment[];
  bounds?: RouteBounds;
}

export interface TransportOption {
  mode: string;
  displayName: string;
  icon: string;
  distance: number;
  duration: number;
  co2Emission?: number;
  isRecommended?: boolean;
}

export interface TransportComparison {
  car?: TransportOption;
  foot?: TransportOption;
  bicycle?: TransportOption;
  motorbike?: TransportOption;
  recommended?: TransportOption;
}

/* ORS RAW TYPES (for parsing) */
interface OrsStep {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  way_name?: string;
}

interface OrsSegment {
  distance: number;
  duration: number;
  steps: OrsStep[];
}

interface OrsRoute {
  summary: {
    distance: number;
    duration: number;
  };
  geometry: {
    coordinates: LonLat[];
  };
  segments: OrsSegment[];
}

interface OrsResponse {
  routes: OrsRoute[];
}

@Injectable({
  providedIn: 'root'
})
export class RouteService {

  private orsUrl = '/ors/v2/directions';
  private apiKey: string = environment.openRouteServiceKey;

  constructor(private http: HttpClient) {}

  /* -------------------------------------------------------
     TRANSPORT MODE PROFILES
  ------------------------------------------------------- */
  private transportProfiles = {
    'driving-car': { speed: 60, displayName: 'Voiture', icon: '🚗' },
    'foot-walking': { speed: 5, displayName: 'À pied', icon: '🚶' },
    'cycling-regular': { speed: 20, displayName: 'Vélo', icon: '🚴' },
    'cycling-electric': { speed: 25, displayName: 'Vélo électrique', icon: '🚴‍♂️' }
  };

  /* -------------------------------------------------------
     HAVERSINE FALLBACK
  ------------------------------------------------------- */

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private generateFallbackRoute(coords: LatLng[]): RouteResponse {
    if (coords.length < 2) {
      return {
        routeCoordinates: [],
        totalDistance: 0,
        totalDuration: 0,
        instructions: []
      };
    }

    let totalDist = 0;
    let totalDur = 0;
    const segments: RouteSegment[] = [];

    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lon1] = coords[i];
      const [lat2, lon2] = coords[i + 1];

      const km = this.haversineDistance(lat1, lon1, lat2, lon2);
      const meters = km * 1000;
      const duration = Math.round((km / 60) * 3600);

      segments.push({ distance: meters, duration });
      totalDist += meters;
      totalDur += duration;
    }

    return {
      routeCoordinates: coords,
      totalDistance: totalDist,
      totalDuration: totalDur,
      instructions: [],
      segments
    };
  }

  /* -------------------------------------------------------
     GET ROUTE FROM ORS
  ------------------------------------------------------- */

  getRoute(coords: LatLng[]): Observable<RouteResponse> {
    return this.getRouteByMode(coords, 'driving-car');
  }

  getRouteByMode(coords: LatLng[], mode: 'driving-car' | 'foot-walking' | 'cycling-regular' | 'cycling-electric'): Observable<RouteResponse> {
    if (coords.length < 2) {
      return of({
        routeCoordinates: [],
        totalDistance: 0,
        totalDuration: 0,
        instructions: []
      });
    }

    const waypoints: LonLat[] = coords.map(([lat, lon]) => [lon, lat]);
    const headers = new HttpHeaders({
      Authorization: this.apiKey,
      'Content-Type': 'application/json'
    });

    const body = { coordinates: waypoints };
    const url = `${this.orsUrl}/${mode}`;

    return this.http.post<OrsResponse>(url, body, { headers }).pipe(
      tap(res => console.log(`✔ ORS ${mode} response:`, res)),
      map((res: OrsResponse) => this.parseOrsResponse(res)),
      catchError(err => {
        console.warn(`⚠ ORS ${mode} failed — using fallback route`);
        return of(this.generateFallbackRoute(coords));
      })
    );
  }

  /* -------------------------------------------------------
     GET ALL TRANSPORT OPTIONS WITH COMPARISON
  ------------------------------------------------------- */

  getTransportComparison(coords: LatLng[]): Observable<TransportComparison> {
    if (coords.length < 2) {
      return of({} as TransportComparison);
    }

    // OpenRouteService n'a pas de mode "motorbike", on utilise cycling-electric comme base
    const modes: Array<'driving-car' | 'foot-walking' | 'cycling-regular' | 'cycling-electric'> = [
      'driving-car',
      'foot-walking',
      'cycling-regular',
      'cycling-electric'
    ];

    return new Observable(observer => {
      const results: Partial<TransportComparison> = {};
      let completed = 0;

      modes.forEach(mode => {
        this.getRouteByMode(coords, mode).subscribe({
          next: (route) => {
            const transportKey = this.getTransportKey(mode);
            const profile = this.transportProfiles[mode];
            
            (results as any)[transportKey] = {
              mode,
              displayName: profile.displayName,
              icon: profile.icon,
              distance: route.totalDistance,
              duration: route.totalDuration,
              co2Emission: this.calculateCO2(route.totalDistance, mode)
            } as TransportOption;

            completed++;
            if (completed === modes.length) {
              this.finalizeTransportComparison(results, observer);
            }
          },
          error: (err) => {
            console.warn(`⚠ ORS ${mode} failed:`, err);
            completed++;
            if (completed === modes.length) {
              this.finalizeTransportComparison(results, observer);
            }
          }
        });
      });
    });
  }

  // Méthode pour mapper les modes ORS aux clés de transport
  private getTransportKey(mode: string): 'car' | 'foot' | 'bicycle' | 'motorbike' {
    switch (mode) {
      case 'driving-car': return 'car';
      case 'foot-walking': return 'foot';
      case 'cycling-regular': return 'bicycle';
      case 'cycling-electric': return 'motorbike';
      default: return 'car';
    }
  }

  // Méthode pour finaliser la comparaison
  private finalizeTransportComparison(results: Partial<TransportComparison>, observer: any) {
    const comparison = results as TransportComparison;
    
    // Adapter les données pour la moto (utilisation de cycling-electric comme proxy)
    if (comparison.motorbike) {
      comparison.motorbike.displayName = 'Moto';
      comparison.motorbike.icon = '🏍️';
      comparison.motorbike.mode = 'motorbike';
      // La moto est plus rapide que le vélo électrique (environ 70% du temps voiture)
      const carDuration = comparison.car?.duration || comparison.motorbike.duration;
      comparison.motorbike.duration = Math.round(carDuration * 0.75);
      comparison.motorbike.co2Emission = this.calculateCO2(comparison.motorbike.distance, 'motorbike');
    }

    // Déterminer la recommandation
    comparison.recommended = this.recommendBestTransport(comparison);
    observer.next(comparison);
    observer.complete();
  }

  // Calcul des émissions CO2
  private calculateCO2(distanceMeters: number, mode: string): number {
    const distanceKm = distanceMeters / 1000;
    switch (mode) {
      case 'driving-car': return distanceKm * 0.12;
      case 'motorbike': return distanceKm * 0.08;
      case 'cycling-electric': return distanceKm * 0.015;
      case 'foot-walking':
      case 'cycling-regular': return 0;
      default: return distanceKm * 0.1;
    }
  }

  /* -------------------------------------------------------
     RECOMMENDATION LOGIC
  ------------------------------------------------------- */

  private recommendBestTransport(comparison: TransportComparison): TransportOption {
    const options = Object.values(comparison).filter(
      (v): v is TransportOption => v && 'mode' in v && v.distance > 0
    );

    if (options.length === 0) {
      return {} as TransportOption;
    }

    const car = comparison.car;
    const foot = comparison.foot;
    const bicycle = comparison.bicycle;
    const motorbike = comparison.motorbike;

    if (!car) return options[0];

    const distanceKm = car.distance / 1000;
    const carDurationMin = car.duration / 60;

    // Logique de recommandation réaliste
    if (distanceKm <= 1.5) {
      // Très courte distance : à pied
      return foot || bicycle || car;
    }
    else if (distanceKm <= 5) {
      // Distance urbaine courte : vélo recommandé
      if (bicycle && bicycle.duration < 25 * 60) {
        return bicycle;
      }
      return foot || car;
    }
    else if (distanceKm <= 15) {
      // Distance moyenne : comparer vélo et voiture
      const bikeDurationMin = bicycle ? bicycle.duration / 60 : Infinity;
      
      if (bikeDurationMin < carDurationMin + 10) {
        return bicycle || car;
      } else if (bikeDurationMin < 45) {
        return bicycle || car;
      }
      return car;
    }
    else if (distanceKm <= 50) {
      // Longue distance : voiture ou moto
      if (motorbike && motorbike.duration < car.duration * 0.85) {
        return motorbike;
      }
      return car;
    }
    else {
      // Très longue distance : voiture
      return car;
    }
  }

  /* -------------------------------------------------------
     PARSE ORS RESPONSE
  ------------------------------------------------------- */

  parseOrsResponse(res: OrsResponse): RouteResponse {
    const route = res.routes?.[0];
    if (!route) {
      return {
        routeCoordinates: [],
        totalDistance: 0,
        totalDuration: 0,
        instructions: []
      };
    }

    const coordinates: LatLng[] = route.geometry.coordinates.map(
      ([lon, lat]): LatLng => [lat, lon]
    );

    const instructions: RouteInstruction[] = [];
    const segments: RouteSegment[] = [];

    route.segments.forEach((segment: OrsSegment) => {
      segments.push({
        distance: segment.distance,
        duration: segment.duration
      });

      segment.steps.forEach((s: OrsStep) => {
        instructions.push({
          distance: s.distance,
          duration: s.duration,
          instruction: s.instruction,
          name: s.name,
          wayName: s.way_name
        });
      });
    });

    const lats = coordinates.map(([lat]) => lat);
    const lons = coordinates.map(([, lon]) => lon);

    return {
      routeCoordinates: coordinates,
      totalDistance: route.summary.distance,
      totalDuration: route.summary.duration,
      instructions,
      segments,
      bounds: {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons)
      }
    };
  }

  /* -------------------------------------------------------
     FORMATTING HELPERS
  ------------------------------------------------------- */

  formatDistance(meters: number): string {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km`
      : `${Math.round(meters)} m`;
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}h ${m}min` : `${m}min`;
  }

  /* -------------------------------------------------------
     TRANSPORT DISPLAY DATA
  ------------------------------------------------------- */

  getTransportDisplayData(comparison: TransportComparison): any {
    const result: any = {};
    
    if (comparison.car) {
      result.car = {
        ...comparison.car,
        formattedDistance: this.formatDistance(comparison.car.distance),
        formattedDuration: this.formatDuration(comparison.car.duration)
      };
    }
    
    if (comparison.foot) {
      result.foot = {
        ...comparison.foot,
        formattedDistance: this.formatDistance(comparison.foot.distance),
        formattedDuration: this.formatDuration(comparison.foot.duration)
      };
    }
    
    if (comparison.bicycle) {
      result.bicycle = {
        ...comparison.bicycle,
        formattedDistance: this.formatDistance(comparison.bicycle.distance),
        formattedDuration: this.formatDuration(comparison.bicycle.duration)
      };
    }
    
    if (comparison.motorbike) {
      result.motorbike = {
        ...comparison.motorbike,
        formattedDistance: this.formatDistance(comparison.motorbike.distance),
        formattedDuration: this.formatDuration(comparison.motorbike.duration)
      };
    }
    
    result.recommended = comparison.recommended;
    
    return result;
  }
}