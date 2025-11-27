import { Component, ViewChild } from '@angular/core';
import { FiltersPanel } from '../../components/filters-panel/filters-panel';
import { GoogleMaps } from '../../components/google-maps/google-maps';
import { CommonModule } from '@angular/common';
import { Place } from '../../models/interfaces';
import { Bucket } from '../../components/bucket/bucket';
import { ItineraryGuidanceComponent } from '../../components/itinerary-guidance/itinerary-guidance';
import { FavoritePlace } from '../../services/bucket.service/bucketService';

interface DayPlan {
  date: string;
  temp: string;
  places: FavoritePlace[];
}

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, FiltersPanel, GoogleMaps, Bucket, ItineraryGuidanceComponent],
  templateUrl: './main-layout.html',
  standalone: true,
  styleUrl: './main-layout.css'
})

export class MainLayout {
  @ViewChild(FiltersPanel) filtersPanel!: FiltersPanel;

  activeFilters: string[] = [];
  places: Place[] = [];

  // Location for API calls (Istanbul, Turkey by default)
  currentLocation: { lat: number; lng: number } = { lat: 41.0082, lng: 28.9784 };
  searchRadius: number = 5000; // meters

  // Itinerary state
  showItinerary = false;
  selectedDay: DayPlan | null = null;
  selectedDayIndex: number | null = null;
  routeCoordinates: [number, number][] = []; // Route for map display
  dayRoutePlaces: Place[] = []; // Places displayed on map in itinerary mode

  onFiltersChanged(filters: string[]) {
    this.activeFilters = filters;
  }

  onPlacesFound(places: Place[]) {
    this.places = places;
    console.log('Places found:', places.length);
  }

  onPlaceDetailsFromMap(place: Place) {
    // Afficher les détails du lieu dans le filtersPanel
    if (this.filtersPanel) {
      this.filtersPanel.selectedPlace = place;
      this.filtersPanel.showPlaceDetails = true;
      // Sauvegarder l'état précédent
      this.filtersPanel.previousPlaces = [...this.places];
    }
  }

  onDaySelected(event: { day: DayPlan; dayIndex: number }): void {
    this.selectedDay = event.day;
    this.selectedDayIndex = event.dayIndex;
    this.showItinerary = true;
    // Build full Place objects for itinerary markers
    const favorites = event.day.places || [];
    this.dayRoutePlaces = favorites.map(fp => {
      // Try to find matching Place from current global list
      const match = this.places.find(p => p.placeId === fp.id || p.name === fp.name);
      if (match) return match;
      // Fallback: construct minimal Place object if coordinates stored in favorite
      const coords = (fp as any).coordinates;
      return {
        name: fp.name,
        address: '',
        rating: 0,
        reviews: 0,
        type: fp.type as any,
        coordinates: coords ? coords : { lat: 0, lng: 0 },
        placeId: fp.id,
        phoneNumber: '',
        website: '',
        photos: [],
        openingHours: []
      } as Place;
    }).filter(p => p.coordinates && p.coordinates.lat && p.coordinates.lng);
    // Relie directement les marqueurs des lieux sélectionnés (lat, lng)
    // en respectant l'ordre des places du jour
    const coords: [number, number][] = (this.selectedDay?.places || [])
      .map(fp => {
        const fpAny: any = fp;
        if (fpAny.coordinates) {
          return [fpAny.coordinates.lat, fpAny.coordinates.lng] as [number, number];
        }
        const match = this.places.find(p => p.placeId === fp.id || p.name === fp.name);
        return match ? [match.coordinates.lat, match.coordinates.lng] as [number, number] : undefined;
      })
      .filter((c): c is [number, number] => Array.isArray(c));

    this.routeCoordinates = coords;

    console.log('🗺️ Itinerary view activated for day:', event.dayIndex, 'coords:', this.routeCoordinates);
  }

  onDayDeselected(): void {
    this.selectedDay = null;
    this.selectedDayIndex = null;
    this.showItinerary = false;
    this.routeCoordinates = []; // Clear route when deselecting
    this.dayRoutePlaces = [];
    console.log('🗺️ Itinerary view closed');
  }
}
