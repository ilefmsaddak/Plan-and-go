import { Component } from '@angular/core';
import { FiltersPanel } from '../../components/filters-panel/filters-panel';
import { GoogleMaps } from '../../components/google-maps/google-maps';
import { CommonModule } from '@angular/common';
import { Place } from '../../models/interfaces';

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, FiltersPanel, GoogleMaps,],
  templateUrl: './main-layout.html',
  standalone: true,
  styleUrl: './main-layout.css'
})

export class MainLayout {
  activeFilters: string[] = [];
  places: Place[] = [];

  // Location for API calls (Istanbul, Turkey by default)
  currentLocation: { lat: number; lng: number } = { lat: 41.0082, lng: 28.9784 };
  searchRadius: number = 5000; // meters

  onFiltersChanged(filters: string[]) {
    this.activeFilters = filters;
  }

  onPlacesFound(places: Place[]) {
    this.places = places;
    console.log('Places found:', places.length);
  }
}
