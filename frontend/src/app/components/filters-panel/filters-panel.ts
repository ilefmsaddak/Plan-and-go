import { Component, Output, EventEmitter, Input, OnInit, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Place } from '../../models/interfaces';
import { PlacesService } from '../../services/places.service';
import { Observable } from 'rxjs';
import { Reviews } from '../reviews/reviews';
@Component({
  selector: 'app-filters-panel',
  imports: [CommonModule,Reviews],
  templateUrl: './filters-panel.html',
  standalone: true,
  styleUrl: './filters-panel.css'
})
export class FiltersPanel implements OnInit, OnChanges {
  @Input() mapLocation: { lat: number; lng: number } = { lat: 41.0082, lng: 28.9784 }; // Istanbul
  @Input() searchRadius: number = 5000; // meters

  @Output() filtersChanged = new EventEmitter<string[]>();
  @Output() placesFound = new EventEmitter<Place[]>();

  showResults = true;  // Show results by default
  resultsCount = 0;
  selectedFilters: string[] = [];
  places: Place[] = [];
  allPlaces: Place[] = [];  // Store all fetched places
  loading = false;
  error: string | null = null;
  hasInitialized = false;
  brokenImages: Set<string> = new Set(); // Track broken images
  service: any;

  constructor(private placesService: PlacesService) {}

  ngOnInit() {
    // Load all places by default on initialization
    this.loadDefaultPlaces();
  }

  ngOnChanges(changes: SimpleChanges) {
    // If mapLocation changes and we haven't initialized yet, initialize now
    if (changes['mapLocation'] && !this.hasInitialized && changes['mapLocation'].currentValue) {
      this.loadDefaultPlaces();
      this.hasInitialized = true;
    }
  }

  selectedPlace: any = null; // Pour stocker le lieu sélectionné
  showPlaceDetails = false; // Pour contrôler l'affichage des détails



  
  // Méthode pour fermer les détails et retourner à la liste
  closePlaceDetails(): void {
    this.showPlaceDetails = false;
    this.selectedPlace = null;
  }


  // Méthode pour formater l'adresse (si nécessaire)
  formatAddress(address: string): string {
    return address.replace(/, Turkey$/, '');
  }
  private loadDefaultPlaces() {
    this.loading = true;
    const allTypes = ['site', 'hotel', 'food', 'cafe', 'shop', 'transports'];
    
    this.placesService
      .searchPlacesByType(this.mapLocation, allTypes, this.searchRadius)
      .subscribe({
        next: (places: Place[]) => {
          // Store all places
          this.allPlaces = places;
          // Show all places by default
          this.places = places;
          this.resultsCount = places.length;
          this.placesFound.emit(places);
          this.loading = false;
          console.log('Default places loaded:', places.length);
        },
        error: (err) => {
          console.error('Error loading default places:', err);
          // Si le service n'est pas prêt, réessayer après 500ms
          if (!this.hasInitialized || err.message?.includes('not initialized')) {
            console.log('PlacesService not ready, retrying...');
            setTimeout(() => {
              this.loadDefaultPlaces();
            }, 500);
          } else {
            this.error = 'Erreur lors du chargement des lieux. Veuillez vérifier votre clé API.';
            this.loading = false;
          }
        }
      });
  }

  toggleFilter(filterType: string) {
    if (this.selectedFilters.includes(filterType)) {
      this.selectedFilters = this.selectedFilters.filter(f => f !== filterType);
    } else {
      this.selectedFilters.push(filterType);
    }
    
    // Update the displayed places based on current filter selection
    this.updatePlacesByFilter();
  }

  private updatePlacesByFilter() {
    if (this.selectedFilters.length === 0) {
      // When no filter is selected, show all places
      this.places = this.allPlaces;
      this.resultsCount = this.allPlaces.length;
      this.placesFound.emit(this.allPlaces);
      this.filtersChanged.emit([]);
    } else {
      // Filter allPlaces based on selected filters
      const filteredPlaces = this.allPlaces.filter(place => 
        this.selectedFilters.includes(place.type)
      );
      this.places = filteredPlaces;
      this.resultsCount = filteredPlaces.length;
      this.placesFound.emit(filteredPlaces);
      this.filtersChanged.emit(this.selectedFilters);
    }
  }

  onPlaceCardClick(place: Place) {
    // Emit an event to the map to highlight this marker
    this.placesFound.emit([place]);
    this.selectedPlace = place;
    console.log('Selected place:', place.placeId);
    this.showPlaceDetails = true;
  }

  onImageError(event: any, place: Place) {
    // Track broken image
    if (place.placeId) {
      this.brokenImages.add(place.placeId);
      
      // Try to fetch alternative photos from Google Places
      this.placesService.getPlacePhotos(place.placeId).subscribe({
        next: (photoUrls: string[]) => {
          if (photoUrls.length > 0) {
            // Find first URL that's different from the broken one
            const brokenUrl = event.target.src;
            const alternativeUrl = photoUrls.find(url => url !== brokenUrl);
            
            if (alternativeUrl) {
              event.target.src = alternativeUrl;
              return;
            }
          }
          // If no alternative from Google Places, search web for the place
          this.searchWebImageForPlace(event, place);
        },
        error: () => {
          // If API call fails, search web for the place
          this.searchWebImageForPlace(event, place);
        }
      });
    } else {
      this.setImageFallback(event, place);
    }
  }

  private searchWebImageForPlace(event: any, place: Place) {
    // Build search query based on place name and type
    const typeKeywords: { [key: string]: string } = {
      site: 'tourist attraction sight',
      hotel: 'hotel building',
      food: 'restaurant food',
      cafe: 'cafe coffee shop',
      shop: 'shopping mall store',
      transports: 'bus station train'
    };
    
    const keyword = typeKeywords[place.type] || 'place';
    const searchTerm = `${place.name} ${keyword}`.toLowerCase().trim().replace(/\s+/g, '+');
    
    // Try multiple image sources in order
    const imageSources = [
      // 1. Unsplash - Free high-quality images
      `https://source.unsplash.com/400x300/?${searchTerm}`,
      
      // 2. Picsum (Lorem Picsum) - Placeholder with actual photos
      `https://picsum.photos/400/300?random=${Math.random()}`,
      
      // 3. DummyImage with a nice color based on type
      this.getColoredPlaceholderUrl(place)
    ];
    
    // Try each source sequentially
    this.tryImageSources(event, place, imageSources, 0);
  }

  private tryImageSources(event: any, place: Place, sources: string[], index: number) {
    if (index >= sources.length) {
      // All sources failed, use SVG fallback
      this.setImageFallback(event, place);
      return;
    }
    
    const img = new Image();
    const timeout = setTimeout(() => {
      // Timeout after 3 seconds per image
      img.onerror?.(null as any);
    }, 3000);
    
    img.onload = () => {
      clearTimeout(timeout);
      event.target.src = sources[index];
      console.log(`Image loaded from source ${index + 1} for ${place.name}`);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.log(`Source ${index + 1} failed for ${place.name}, trying next...`);
      // Try next source
      this.tryImageSources(event, place, sources, index + 1);
    };
    
    img.src = sources[index];
  }

  private getColoredPlaceholderUrl(place: Place): string {
    const colors: { [key: string]: string } = {
      site: '4285f4',      // Blue
      hotel: '34a853',     // Green
      food: 'fbbc05',      // Yellow
      cafe: 'ea4335',      // Red
      shop: 'f39c12',      // Orange
      transports: 'ff6d00' // Deep Orange
    };
    const bgColor = colors[place.type] || '9c27b0';
    const textColor = 'ffffff';
    
    // Use DummyImage API
    return `https://dummyimage.com/400x300/${bgColor}/${textColor}&text=${encodeURIComponent(place.name.substring(0, 20))}`;
  }

  private setImageFallback(event: any, place: Place) {
    const typeIcons: { [key: string]: string } = {
      site: '📷',
      hotel: '🏨',
      food: '🍽️',
      cafe: '☕',
      shop: '🛍️',
      transports: '🚌'
    };
    const emoji = typeIcons[place.type] || '📍';
    const colors: { [key: string]: string } = {
      site: 'e3f2fd',
      hotel: 'e8f5e9',
      food: 'fffde7',
      cafe: 'ffebee',
      shop: 'fff3e0',
      transports: 'ffe0b2'
    };
    const bgColor = colors[place.type] || 'f5f5f5';
    event.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23${bgColor}' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='80' fill='%23999'%3E${emoji}%3C/text%3E%3C/svg%3E`;
  }

  getStars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  getPlaceIcon(type: string): string {
    return this.placesService.getPlaceIcon(type);
  }

  getMarkerColor(type: string): string {
    return this.placesService.getMarkerColor(type);
  }

  getPlacePhoto(place: Place): string {
    if (place.photos && place.photos.length > 0) {
      return place.photos[0];
    }
    // Fallback image based on place type
    const typeIcons: { [key: string]: string } = {
      site: '📷',
      hotel: '🏨',
      food: '🍽️',
      cafe: '☕',
      shop: '🛍️',
      transports: '🚌'
    };
    
    // Return a colored placeholder with emoji
    const emoji = typeIcons[place.type] || '📍';
    const colors: { [key: string]: string } = {
      site: 'e3f2fd',
      hotel: 'e8f5e9',
      food: 'fffde7',
      cafe: 'ffebee',
      shop: 'fff3e0',
      transports: 'ffe0b2'
    };
    const bgColor = colors[place.type] || 'f5f5f5';
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23${bgColor}' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='80' fill='%23999'%3E${emoji}%3C/text%3E%3C/svg%3E`;
  }


  
}
