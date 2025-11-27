import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteService, RouteResponse, TransportComparison, TransportOption } from '../../services/route.service';
import { FavoritePlace } from '../../services/bucket.service/bucketService';



@Component({
  selector: 'app-itinerary-guidance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './itinerary-guidance.html',
  styleUrls: ['./itinerary-guidance.css']
})
export class ItineraryGuidanceComponent implements OnChanges {

  @Input() places: FavoritePlace[] = [];
  @Input() dayDate: string = '';
  @Output() routeCalculated = new EventEmitter<[number, number][]>(); 

  route: RouteResponse | null = null;
  loading = false;
  error: string | null = null;
  currentStepIndex = 0;
  legSummaries: { from: string; to: string; distanceM: number; durationS: number; text: string }[] = [];
  
  // Transport comparison
  transportComparison: TransportComparison | null = null;
  transportDisplayData: any = null;
  selectedTransport: 'car' | 'foot' | 'bicycle' | 'motorbike' = 'car';

  constructor(public routeService: RouteService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['places'] && this.places.length > 0) {
      this.calculateRoute();
    }
  }

  calculateRoute(): void {
    if (this.places.length < 2) {
      this.error = 'Need at least 2 places to generate an itinerary';
      return;
    }

    this.loading = true;
    this.error = null;

    // Get coordinates of places
    const coordinates = this.places
      .filter(p => (p as any).coordinates)
      .map(p => [(p as any).coordinates.lat, (p as any).coordinates.lng]) as [number, number][];

    if (coordinates.length < 2) {
      this.loading = false;
      this.error = 'Coordinates missing for at least one place. Add places with coordinates.';
      return;
    }

    console.log('📍 Calculating route for places:', coordinates);

    // Récupérer d'abord la comparaison des transports
    this.routeService.getTransportComparison(coordinates).subscribe({
      next: (comparison: TransportComparison) => {
        this.transportComparison = comparison;
        this.transportDisplayData = this.routeService.getTransportDisplayData(comparison);
        
        // Utiliser le mode recommandé pour calculer l'itinéraire détaillé
        const recommendedMode = comparison.recommended?.mode || 'driving-car';
        this.selectedTransport = this.getTransportKey(recommendedMode);
        
        // Calculer l'itinéraire détaillé avec le mode sélectionné
        this.calculateDetailedRoute(coordinates, recommendedMode);
      },
      error: (err) => {
        console.error('❌ Error getting transport comparison:', err);
        this.error = 'Error comparing transport modes.';
        this.loading = false;
      }
    });
  }

  private calculateDetailedRoute(coordinates: [number, number][], mode: string): void {
    const routeMode = this.getRouteMode(this.selectedTransport);
    
    this.routeService.getRouteByMode(coordinates, routeMode).subscribe({
      next: (response: RouteResponse) => {
        console.log('🔍 Detailed route response:', response);
        if (!response.instructions || response.instructions.length === 0) {
          console.warn('⚠️ No instructions found in route response');
        }
        this.route = response;
        this.currentStepIndex = 0;
        this.buildLegSummaries();

        // Send coordinates to parent map
        if (response.routeCoordinates.length > 0) {
          this.routeCalculated.emit(response.routeCoordinates);
          console.log('📤 Route coordinates emitted to parent');
        }

        this.loading = false;
        console.log('✅ Route calculated with transport:', this.selectedTransport);
      },
      error: (err) => {
        console.error('❌ Error calculating detailed route:', err);
        this.error = 'Error calculating detailed route.';
        this.loading = false;
      }
    });
  }

  selectTransport(transport: 'car' | 'foot' | 'bicycle' | 'motorbike'): void {
    this.selectedTransport = transport;
    
    // Recalculate route with selected mode
    const coordinates = this.places
      .filter(p => (p as any).coordinates)
      .map(p => [(p as any).coordinates.lat, (p as any).coordinates.lng]) as [number, number][];

    if (coordinates.length >= 2) {
      const routeMode = this.getRouteMode(transport);
      this.calculateDetailedRoute(coordinates, routeMode);
    }
  }

  private getRouteMode(transport: 'car' | 'foot' | 'bicycle' | 'motorbike'): 'driving-car' | 'foot-walking' | 'cycling-regular' | 'cycling-electric' {
    switch (transport) {
      case 'car': return 'driving-car';
      case 'foot': return 'foot-walking';
      case 'bicycle': return 'cycling-regular';
      case 'motorbike': return 'cycling-electric';
      default: return 'driving-car';
    }
  }

  private getTransportKey(mode: string): 'car' | 'foot' | 'bicycle' | 'motorbike' {
    switch (mode) {
      case 'driving-car': return 'car';
      case 'foot-walking': return 'foot';
      case 'cycling-regular': return 'bicycle';
      case 'motorbike': 
      case 'cycling-electric': return 'motorbike';
      default: return 'car';
    }
  }

  nextStep(): void {
    if (this.route && this.currentStepIndex < this.route.instructions.length - 1) {
      this.currentStepIndex++;
    }
  }

  previousStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
  }

  getInstructionIcon(instruction: string): string {
    if (instruction.includes('right')) return '➡️';
    if (instruction.includes('left')) return '⬅️';
    if (instruction.includes('U-turn')) return '↩️';
    if (instruction.includes('straight')) return '⬆️';
    if (instruction.includes('roundabout')) return '🔄';
    return '➡️';
  }

  getRecommendationExplanation(recommended: any): string {
    if (!recommended) return 'Optimal option based on distance and duration';

    const mode = recommended.mode || '';
    const distance = recommended.distance || 0;
    const duration = recommended.duration || 0;

    if (mode.includes('foot')) {
      return `Short distance (${this.routeService.formatDistance(distance)}) - Walking recommended for health and ecology`;
    } else if (mode.includes('cycling')) {
      return `Medium distance (${this.routeService.formatDistance(distance)}) - Cycling recommended for exercise and speed`;
    } else if (mode.includes('car')) {
      return `Long distance (${this.routeService.formatDistance(distance)}) - Car recommended for comfort`;
    } else if (mode.includes('motorbike')) {
      return `Fast trip (${this.routeService.formatDuration(duration)}) - Motorbike recommended to save time`;
    } else {
      return `Best choice: ${this.routeService.formatDuration(duration)} for ${this.routeService.formatDistance(distance)}`;
    }
  }

  private buildLegSummaries(): void {
    this.legSummaries = [];
    if (!this.route || !this.route.segments || this.places.length < 2) return;

    const segments = this.route.segments;
    const n = Math.min(segments.length, this.places.length - 1);
    for (let i = 0; i < n; i++) {
      const from = this.places[i]?.name || `Place ${i + 1}`;
      const to = this.places[i + 1]?.name || `Place ${i + 2}`;
      const dist = segments[i].distance || 0;
      const dur = segments[i].duration || 0;
      const transportName = this.getTransportDisplayName();
      const text = `From ${from} to ${to} — ${this.routeService.formatDuration(dur)} (${this.routeService.formatDistance(dist)}) by ${transportName}`;
      this.legSummaries.push({ from, to, distanceM: dist, durationS: dur, text });
    }
  }

  private getTransportDisplayName(): string {
    switch (this.selectedTransport) {
      case 'car': return 'car';
      case 'foot': return 'walking';
      case 'bicycle': return 'bicycle';
      case 'motorbike': return 'motorbike';
      default: return 'car';
    }
  }
}