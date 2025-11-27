/// <reference types="leaflet" />
import { AfterViewInit, Component, Input, OnChanges, SimpleChanges, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { environment } from '../../environment/env';
import { Place } from '../../models/interfaces';
import { PlacesService } from '../../services/places.service';
import { LeafletMapService } from '../../services/leaflet-map.service';
import * as L from 'leaflet';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-google-maps',
  imports: [],
  templateUrl: './google-maps.html',
  styleUrl: './google-maps.css',
  standalone: true
})
export class GoogleMaps implements AfterViewInit, OnChanges, OnDestroy, OnInit {
  @Input() activeFilters: string[] = [];
  @Input() initialLocation: string = 'Istanbul, Turkey';
  @Input() places: Place[] = [];
  @Input() routeCoordinates: [number, number][] = []; // NEW: For displaying route
  @Input() highlightedPlaceIds: string[] = [];
  @Output() placeDetailsRequested = new EventEmitter<Place>();

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private mapReady: boolean = false;
  private mapInitialized: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  private routePolyline: L.Polyline | null = null; // Deprecated: managed by LeafletMapService

  constructor(
    private placesService: PlacesService,
    private leafletMapService: LeafletMapService,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    console.log('🗺️ Map component initialized');
    // Écouter l'événement custom pour afficher les détails du lieu
    window.addEventListener('showPlaceDetails', () => {
      const placeId = (window as any).detailsPlaceId;
      const place = this.places.find(p => p.placeId === placeId);
      if (place) {
        this.placeDetailsRequested.emit(place);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['places']) {
      const newPlaces = changes['places'].currentValue || [];
      console.log('📍 Places changed:', newPlaces.length, newPlaces.map((p: Place) => p.name));

      if (this.mapReady) {
        this.updateMarkers(newPlaces);
      } else {
        this.delayedMarkerUpdate(newPlaces);
      }
    }

    if (changes['activeFilters']) {
      console.log('🔍 Active filters changed:', changes['activeFilters'].currentValue);
      this.applyFilters();
    }

    // NEW: Handle route coordinates
    if (changes['routeCoordinates']) {
      const coordinates = changes['routeCoordinates'].currentValue || [];
      if (coordinates.length > 0) {
        console.log('🛣️ Route coordinates received:', coordinates.length);
        if (this.mapReady) {
          this.displayRoute(coordinates);
        } else {
          // Retry when map is ready
          const retryInterval = setInterval(() => {
            if (this.mapReady) {
              this.displayRoute(coordinates);
              clearInterval(retryInterval);
            }
          }, 100);
        }
      } else {
        this.clearRoute();
      }
    }
  }

  ngAfterViewInit(): void {
    console.log('🗺️ AfterViewInit - Initializing map');
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.initMap();
    }, 0);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initMap(): void {
    if (this.mapInitialized) {
      console.warn('⚠️ Map already initialized');
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('❌ Map element not found');
      // Retry after a short delay
      setTimeout(() => this.initMap(), 100);
      return;
    }

    console.log('🗺️ Found map element, initializing Leaflet service...');

    // Use the LeafletMapService to initialize the map
    this.leafletMapService.initialize(mapElement, { lat: 41.0082, lng: 28.9784 }, 12)
      .then(() => {
        console.log('✅ Leaflet map service initialized successfully');
        this.mapReady = true;
        this.mapInitialized = true;

        // Initialize places service
        this.placesService.initializeService(this.map as any);

        // Add initial markers if any
        if (this.places.length > 0) {
          console.log('📍 Adding initial markers:', this.places.length);
          this.addCustomMarkers(this.places);
        }

        // Force refresh after initialization
        setTimeout(() => {
          this.forceRefresh();
        }, 500);
      })
      .catch(error => {
        console.error('❌ Failed to initialize Leaflet map service:', error);
        // Fallback: try direct initialization
        this.fallbackMapInitialization(mapElement);
      });
  }

  private fallbackMapInitialization(mapElement: HTMLElement): void {
    try {
      console.log('🔄 Attempting fallback map initialization...');

      this.ensureMapContainerSize(mapElement);

      this.map = L.map(mapElement, {
        center: [41.0082, 28.9784],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        trackResize: true,
        renderer: L.canvas()
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Add zoom control
      L.control.zoom({
        position: 'bottomright'
      }).addTo(this.map);

      // Set up map events
      this.map.on('load', () => {
        console.log('🗺️ Map loaded event fired');
        this.finalizeMapInitialization();
      });

      this.map.whenReady(() => {
        console.log('🗺️ Map ready callback');
        this.finalizeMapInitialization();
      });

      // Fallback initialization
      setTimeout(() => {
        if (!this.mapReady) {
          console.log('🕒 Fallback map initialization timeout');
          this.finalizeMapInitialization();
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error in fallback map initialization:', error);
    }
  }

  private ensureMapContainerSize(mapElement: HTMLElement): void {
    const computedStyle = window.getComputedStyle(mapElement);

    if (computedStyle.height === '0px' || computedStyle.height === 'auto') {
      console.warn('⚠️ Map container has no height, setting default height');
      mapElement.style.height = '100vh';
    }

    if (computedStyle.width === '0px' || computedStyle.width === 'auto') {
      console.warn('⚠️ Map container has no width, setting default width');
      mapElement.style.width = '100%';
    }
  }

  private finalizeMapInitialization(): void {
    if (this.mapReady) return;

    console.log('🔧 Finalizing map initialization...');

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize({ pan: false });

        setTimeout(() => {
          this.map?.invalidateSize({ pan: false });
          this.mapReady = true;
          this.mapInitialized = true;

          console.log('✅ Map fully initialized and ready');

          // Add initial markers
          if (this.places.length > 0) {
            console.log('📍 Adding initial markers:', this.places.length);
            this.addCustomMarkers(this.places);
          }

          // One more invalidation for good measure
          setTimeout(() => {
            this.map?.invalidateSize({ pan: false });
          }, 100);
        }, 100);
      }
    }, 100);
  }

  private delayedMarkerUpdate(places: Place[]) {
    let retries = 0;
    const maxRetries = 50;

    const tryAddMarkers = () => {
      retries++;
      if (this.mapReady) {
        console.log('📍 Adding markers after ' + retries + ' retries:', places.length);
        this.updateMarkers(places);
      } else if (retries < maxRetries) {
        setTimeout(tryAddMarkers, 100);
      } else {
        console.error('❌ Map failed to initialize after 5 seconds');
      }
    };

    tryAddMarkers();
  }

  private updateMarkers(places: Place[]) {
    console.log('🎯 Updating markers, clearing all and adding:', places.length);
    this.clearMarkers();
    if (places.length > 0) {
      // Add markers with potential highlight for selected day
      const highlightSet = new Set(this.highlightedPlaceIds || []);
      if (this.highlightedPlaceIds && this.highlightedPlaceIds.length > 0 && (this.leafletMapService as any).addMarkersWithHighlight) {
        (this.leafletMapService as any).addMarkersWithHighlight(places, highlightSet, (place: Place) => {
          this.onMarkerClick(place);
        });
      } else {
        // Fallback to normal markers
        console.log('📌 Adding', places.length, 'markers to map');
        this.leafletMapService.addMarkers(places, (place) => {
          this.onMarkerClick(place);
        });
      }

      // Also fit bounds to show all markers
      console.log('📐 Fitting bounds for', places.length, 'places');
      this.leafletMapService.fitBounds(places);
    }
  }

  private onMarkerClick(place: Place): void {
    console.log('📍 Marker clicked:', place.name);
    // Handle marker click event
  }

  private applyFilters() {
    if (!this.places.length || !this.mapReady) return;

    // For now, just update markers with filtered places
    const filteredPlaces = this.activeFilters.length > 0
      ? this.places.filter(place => this.activeFilters.includes(place.type))
      : this.places;

    this.updateMarkers(filteredPlaces);
  }

  private clearMarkers(): void {
    this.leafletMapService.clearMarkers();
  }

  private addCustomMarkers(places: Place[]) {
    console.log(`🎯 Adding ${places.length} markers using LeafletMapService`);
    this.leafletMapService.addMarkers(places, (place) => {
      this.onMarkerClick(place);
    });

    // Fit bounds to show markers
    this.leafletMapService.fitBounds(places);
  }

  // Public methods
  public clearAllMarkers() {
    this.leafletMapService.clearMarkers();
  }

  public centerOnLocation(lat: number, lng: number, zoom: number = 15) {
    this.leafletMapService.centerOnLocation(lat, lng, zoom);
  }

  public refreshMap() {
    if (this.leafletMapService.isReady()) {
      (this.leafletMapService as any).refreshMap?.();
    } else if (this.map) {
      this.map.invalidateSize();
    }
  }

  // Add the forceRefresh method for the template button
  public forceRefresh(): void {
    console.log('🔄 Manually refreshing map');
    this.refreshMap();
  }

  public getVisibleMarkersCount(): number {
    // You might need to implement this in LeafletMapService
    return this.places.length;
  }

  public calculateAndDisplayRoute() {
    console.warn('⚠️ Route calculation not yet implemented');
    // You can implement this using leafletMapService.calculateRoute()
  }

  // NEW: Display route polyline on map
  private displayRoute(coordinates: [number, number][]): void {
    if (coordinates.length < 2) {
      console.warn('⚠️ Cannot display route: invalid coordinates');
      return;
    }

    // Delegate to LeafletMapService
    this.leafletMapService.displayRoutePolyline(coordinates);
    console.log('✅ Route polyline rendered via LeafletMapService');
  }

  // NEW: Clear route polyline
  private clearRoute(): void {
    // Delegate to LeafletMapService
    this.leafletMapService.clearRoutePolyline();
    this.routePolyline = null;
    console.log('🧹 Route polyline removed');
  }

  private cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Clear markers through the service
    this.leafletMapService.clearMarkers();

    if (this.map) {
      this.map.remove();
      this.mapInitialized = false;
      this.mapReady = false;
    }

    console.log('🧹 Map cleanup completed');
  }
}
