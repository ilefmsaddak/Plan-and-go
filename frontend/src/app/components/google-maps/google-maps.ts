/// <reference types="@types/google.maps" />
import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { environment } from '../../environment/env';
import { Place } from '../../models/interfaces';
import { PlacesService } from '../../services/places.service';

@Component({
  selector: 'app-google-maps',
  imports: [],
  templateUrl: './google-maps.html',
  styleUrl: './google-maps.css',
  standalone: true
})
export class GoogleMaps implements AfterViewInit, OnChanges {
  @Input() activeFilters: string[] = [];
  @Input() initialLocation: string = 'Istanbul, Turkey';
  @Input() places: Place[] = [];

  map!: google.maps.Map;
  directionsService!: google.maps.DirectionsService;
  directionsRenderer!: google.maps.DirectionsRenderer;
  originAutocomplete!: any;
  destinationAutocomplete!: any;

  private originPlace: google.maps.places.PlaceResult | null = null;
  private destinationPlace: google.maps.places.PlaceResult | null = null;

  // Stocker les marqueurs
  private markers: google.maps.Marker[] = [];
  private mapReady: boolean = false;

  constructor(private placesService: PlacesService) { }

  // Déplacer les icônes dans une méthode pour éviter l'initialisation prématurée
  private getMarkerIcons() {
    return {
      site: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285f4',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      },
      hotel: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#34a853',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      },
      food: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#fbbc05',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      },
      cafe: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#ea4335',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      },
      transports: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#ff6d00',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      },
      shop: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#f39c12',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10
      }
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    // Lorsque les places changent, les ajouter à la carte
    if (changes['places']) {
      const newPlaces = changes['places'].currentValue || [];

      if (this.mapReady && this.isGoogleMapsLoaded()) {
        // Map est prête, ajouter les marqueurs immédiatement
        console.log('Places received (map ready):', newPlaces.length);
        this.clearMarkers();
        if (newPlaces.length > 0) {
          this.addCustomMarkers(newPlaces);
        }
      } else {
        // Map n'est pas encore prête, attendre et réessayer plusieurs fois
        const placesToAdd = newPlaces;
        let retries = 0;
        const maxRetries = 30; // 30 tentatives × 100ms = 3 secondes max

        const tryAddMarkers = () => {
          retries++;
          if (this.mapReady && this.isGoogleMapsLoaded()) {
            console.log('Places received (retry ' + retries + '):', placesToAdd.length);
            this.clearMarkers();
            if (placesToAdd.length > 0) {
              this.addCustomMarkers(placesToAdd);
            }
          } else if (retries < maxRetries) {
            setTimeout(tryAddMarkers, 100);
          } else {
            console.error('Map failed to initialize after 3 seconds');
          }
        };

        tryAddMarkers();
      }
    }
  }

  ngAfterViewInit(): void {
    this.loadGoogleMapsScript().then(() => {
      this.initMap();
    }).catch(error => {
      console.error('Failed to load Google Maps:', error);
    });
  }

  // Vérifier si Google Maps est chargé
  private isGoogleMapsLoaded(): boolean {
    return typeof google !== 'undefined' && google.maps !== undefined;
  }

  // Gérer les changements de filtres
  private handleFiltersChange(filters: string[]) {
    if (this.map && this.isGoogleMapsLoaded()) {
      this.updateMapMarkers(filters);
    }
  }

  // Mettre à jour les marqueurs basés sur les filtres
  private updateMapMarkers(filters: string[]) {
    if (!this.places) return;

    const filteredPlaces =
      filters.length === 0
        ? this.places
        : this.places.filter(p => filters.includes(p.type));

    this.clearMarkers();
    this.addCustomMarkers(filteredPlaces);
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
  }

  // Ajouter des marqueurs personnalisés
  private addCustomMarkers(places: Place[]) {
    if (!this.isGoogleMapsLoaded()) {
      console.warn('Google Maps not loaded, cannot add markers');
      return;
    }

    // Display all received places without additional filtering
    // (parent already handles filtering)
    places.forEach(place => {
      // Créer un marqueur avec icône HTML (emoji)
      const marker = new google.maps.Marker({
        position: new google.maps.LatLng(place.coordinates.lat, place.coordinates.lng),
        map: this.map,
        title: place.name,
        icon: this.createEmojiMarker(place.type),
        optimized: false
      });

      // Créer une info window riche avec image
      const photoUrl = place.photos && place.photos.length > 0
        ? place.photos[0]
        : 'https://via.placeholder.com/300x200?text=No+Image';

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="info-window" style="
            width: 320px;
            font-family: 'Segoe UI', Arial;
            border-radius: 8px;
            overflow: hidden;
          ">
            <div style="position: relative; background: #f5f5f5;">
              <img src="${photoUrl}" alt="${place.name}" style="
                width: 100%;
                height: 180px;
                object-fit: cover;
                display: block;
              "/>
              <div style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: #fff;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                color: #667eea;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">${place.type}</div>
            </div>
            <div style="padding: 16px;">
              <h3 style="
                margin: 0 0 8px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
              ">${place.name}</h3>
              <p style="
                margin: 0 0 12px 0;
                color: #666;
                font-size: 13px;
                line-height: 1.5;
              ">
                📍 ${place.address}
              </p>
              <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
              ">
                <span style="
                  color: #ffc107;
                  font-size: 14px;
                  letter-spacing: 1px;
                ">${this.getStars(place.rating)}</span>
                <span style="
                  color: #999;
                  font-size: 12px;
                ">(${place.reviews.toLocaleString()} avis)</span>
              </div>
              <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
              ">
                <a href="https://www.google.com/maps/place/?q=place_id:${place.placeId}" 
                   target="_blank"
                   style="
                  padding: 8px 12px;
                  background: #667eea;
                  color: white;
                  text-align: center;
                  border-radius: 6px;
                  font-size: 12px;
                  font-weight: 600;
                  text-decoration: none;
                  cursor: pointer;
                  border: none;
                ">
                  View on Maps
                </a>
                <a href="https://www.google.com/search?q=${encodeURIComponent(place.name)}" 
                   target="_blank"
                   style="
                  padding: 8px 12px;
                  background: #f0f0f0;
                  color: #333;
                  text-align: center;
                  border-radius: 6px;
                  font-size: 12px;
                  font-weight: 600;
                  text-decoration: none;
                  cursor: pointer;
                  border: none;
                ">
                  🔍 Search
                </a>
              </div>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        // Fermer toutes les autres fenêtres d'information
        this.markers.forEach(m => {
          const currentInfoWindow = (m as any).infoWindow;
          if (currentInfoWindow) {
            currentInfoWindow.close();
          }
        });

        infoWindow.open(this.map, marker);
        // Stocker la référence à la fenêtre d'information
        (marker as any).infoWindow = infoWindow;
      });

      // Ajouter un hover effet
      marker.addListener('mouseover', () => {
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
      });

      marker.addListener('mouseout', () => {
        marker.setZIndex(1);
      });


      this.markers.push(marker);
    });

    // Ajuster les limites de la carte pour montrer tous les marqueurs
    if (this.markers.length > 0) {
      this.fitMapBounds();
    }
  }

  private getMarkerIcon(type: string): google.maps.Symbol {
    const markerIcons = this.getMarkerIcons();
    // Icône par défaut si le type n'est pas trouvé
    const defaultIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#666666',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#ffffff',
      scale: 8
    };

    return markerIcons[type as keyof typeof markerIcons] || defaultIcon;
  }

  private createEmojiMarker(type: string): google.maps.Icon {
    // Mapper les types aux emojis
    const emojiMap: { [key: string]: string } = {
      site: '📷',
      hotel: '🏨',
      food: '🍽️',
      cafe: '☕',
      shop: '🛍️',
      transports: '🚌'
    };

    const emoji = emojiMap[type] || '📍';

    // Créer un canvas avec l'emoji
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Fond blanc avec bordure
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(20, 20, 18, 0, Math.PI * 2);
      ctx.fill();

      // Bordure colorée selon le type
      const colorMap: { [key: string]: string } = {
        site: '#4285f4',
        hotel: '#34a853',
        food: '#fbbc05',
        cafe: '#ea4335',
        shop: '#f39c12',
        transports: '#ff6d00'
      };

      ctx.strokeStyle = colorMap[type] || '#667eea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(20, 20, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Emoji
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 20, 20);
    }

    return {
      url: canvas.toDataURL(),
      scaledSize: new google.maps.Size(40, 40),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(20, 20)
    };
  }

  private fitMapBounds() {
    if (this.markers.length === 0 || !this.isGoogleMapsLoaded()) return;

    const bounds = new google.maps.LatLngBounds();
    this.markers.forEach(marker => {
      const position = marker.getPosition();
      if (position) {
        bounds.extend(position);
      }
    });

    this.map.fitBounds(bounds);

    // Ne pas zoomer trop si un seul marqueur
    if (this.markers.length === 1) {
      const listener = google.maps.event.addListener(this.map, 'bounds_changed', () => {
        this.map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  }

  private getStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isGoogleMapsLoaded()) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.waitForGoogleMaps().then(resolve).catch(reject);
      };

      script.onerror = (error) => {
        reject(new Error('Failed to load Google Maps script'));
      };

      document.head.appendChild(script);
    });
  }

  private waitForGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;

      const checkGoogleMaps = () => {
        attempts++;
        if (this.isGoogleMapsLoaded()) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkGoogleMaps, 100);
        } else {
          reject(new Error('Google Maps failed to initialize within timeout'));
        }
      };

      checkGoogleMaps();
    });
  }

  private initMap() {
    if (!this.isGoogleMapsLoaded()) {
      console.error('Google Maps not available when initMap was called');
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }

    try {
      // Créer la carte avec configuration pour montrer UNIQUEMENT les marqueurs personnalisés
      this.map = new google.maps.Map(mapElement, {
        center: { lat: 41.0082, lng: 28.9784 }, // Istanbul
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'poi',
            elementType: 'geometry',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'poi.park',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Initialiser le PlacesService après la création de la map
      console.log("initalize service")
      this.placesService.initializeService(this.map);

      // Centrer la carte sur la localisation initiale
      this.centerMapToLocation(this.initialLocation);

      this.directionsService = new google.maps.DirectionsService();

      const warningsPanel = document.getElementById('warnings-panel');
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.map,
        panel: warningsPanel || undefined,
        suppressMarkers: true, // Hide default markers from directions
        polylineOptions: {
          strokeColor: '#667eea',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });

      // Ajouter les marqueurs personnalisés APRÈS la création de la map
      if (this.places.length > 0) {
        this.addCustomMarkers(this.places);
      }

      this.initPlacesAutocomplete();

      // Marquer la carte comme prête
      this.mapReady = true;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private centerMapToLocation(location: string) {
    if (!this.isGoogleMapsLoaded()) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: location }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        this.map.setCenter(results[0].geometry.location);
        this.map.setZoom(12); // Ajuster le zoom pour la vue de la ville
      } else {
        console.warn('Geocoding failed for location:', location, status);
      }
    });
  }

  private async initPlacesAutocomplete() {
    if (!this.isGoogleMapsLoaded()) return;

    const originInput = document.getElementById('origin-input') as HTMLInputElement;
    const destinationInput = document.getElementById('destination-input') as HTMLInputElement;

    if (!originInput || !destinationInput) {
      console.error('Input elements not found');
      return;
    }

    this.initLegacyAutocompleteWithFallback(originInput, destinationInput);
  }

  private initLegacyAutocompleteWithFallback(originInput: HTMLInputElement, destinationInput: HTMLInputElement) {
    if (!this.isGoogleMapsLoaded()) return;

    try {
      this.originAutocomplete = new google.maps.places.Autocomplete(originInput, {
        fields: ['geometry', 'name', 'formatted_address']
      });

      this.destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {
        fields: ['geometry', 'name', 'formatted_address']
      });

      this.originAutocomplete.bindTo('bounds', this.map);
      this.destinationAutocomplete.bindTo('bounds', this.map);

      this.originAutocomplete.addListener('place_changed', () => {
        this.originPlace = this.originAutocomplete.getPlace();
        this.updateInputStyle('origin-input', true);
      });

      this.destinationAutocomplete.addListener('place_changed', () => {
        this.destinationPlace = this.destinationAutocomplete.getPlace();
        this.updateInputStyle('destination-input', true);
      });

    } catch (legacyError) {
      console.error('Legacy Autocomplete failed:', legacyError);
      this.showManualInputInstructions();
    }
  }

  private updateInputStyle(inputId: string, isValid: boolean) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      if (isValid) {
        input.style.borderColor = '#4CAF50';
        input.style.backgroundColor = '#f8fff8';
      } else {
        input.style.borderColor = '#ccc';
        input.style.backgroundColor = '';
      }
    }
  }

  private showManualInputInstructions() {
    const originInput = document.getElementById('origin-input') as HTMLInputElement;
    const destinationInput = document.getElementById('destination-input') as HTMLInputElement;

    if (originInput && destinationInput) {
      originInput.placeholder = 'Enter origin address manually';
      destinationInput.placeholder = 'Enter destination address manually';
    }
  }

  calculateAndDisplayRoute() {
    this.calculateRouteWithStoredPlaces();
  }

  private calculateRouteWithStoredPlaces() {
    if (!this.originPlace || !this.destinationPlace) {
      const currentOriginPlace = this.originAutocomplete.getPlace();
      const currentDestinationPlace = this.destinationAutocomplete.getPlace();

      if (!currentOriginPlace?.geometry?.location || !currentDestinationPlace?.geometry?.location) {
        this.tryGeocodeFromInputs();
        return;
      }

      this.originPlace = currentOriginPlace;
      this.destinationPlace = currentDestinationPlace;
    }

    const originLocation = this.getLocationFromPlace(this.originPlace, 'origin');
    const destinationLocation = this.getLocationFromPlace(this.destinationPlace, 'destination');

    if (originLocation && destinationLocation) {
      this.calculateRoute(originLocation, destinationLocation);
    } else {
      this.tryGeocodeFromInputs();
    }
  }

  private getLocationFromPlace(place: google.maps.places.PlaceResult | null, placeType: string): google.maps.LatLng | null {
    if (!place?.geometry?.location) {
      console.warn(`No location found for ${placeType}:`, place);
      return null;
    }

    const location = place.geometry.location;

    if (!(location instanceof google.maps.LatLng)) {
      console.warn(`Invalid location type for ${placeType}:`, location);
      return null;
    }

    return location;
  }

  private tryGeocodeFromInputs() {
    const originInput = document.getElementById('origin-input') as HTMLInputElement;
    const destinationInput = document.getElementById('destination-input') as HTMLInputElement;

    if (!originInput.value || !destinationInput.value) {
      alert('Please enter both origin and destination addresses.');
      return;
    }

    alert('Please select addresses from the dropdown suggestions for better accuracy, or we will try to use your entered text.');
    this.geocodeAndCalculateRoute(originInput.value, destinationInput.value);
  }

  private async geocodeAndCalculateRoute(originAddress: string, destinationAddress: string) {
    try {
      const [originLocation, destinationLocation] = await Promise.all([
        this.geocodeAddress(originAddress),
        this.geocodeAddress(destinationAddress)
      ]);

      if (originLocation && destinationLocation) {
        this.calculateRoute(originLocation, destinationLocation);
      } else {
        alert('Could not find locations for the entered addresses. Please ensure they are valid and try again.');
      }
    } catch (error) {
      alert('Error finding locations. Please try again.');
    }
  }

  private geocodeAddress(address: string): Promise<google.maps.LatLng | null> {
    return new Promise((resolve) => {
      if (!this.isGoogleMapsLoaded()) {
        resolve(null);
        return;
      }

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].geometry.location);
        } else {
          console.warn('Geocoding failed for address:', address, status);
          resolve(null);
        }
      });
    });
  }

  private calculateRoute(origin: google.maps.LatLng, destination: google.maps.LatLng) {
    if (!this.isGoogleMapsLoaded()) return;

    this.directionsService.route(
      {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (response, status) => {
        if (status === 'OK' && response) {
          this.directionsRenderer.setDirections(response);
        } else {
          alert('Directions request failed due to ' + status);
        }
      }
    );
  }

  // Méthode pour effacer tous les marqueurs (peut être appelée depuis l'extérieur)
  public clearAllMarkers() {
    this.clearMarkers();
  }

  // Méthode pour centrer la carte sur un lieu spécifique
  public centerOnLocation(lat: number, lng: number, zoom: number = 15) {
    if (this.map && this.isGoogleMapsLoaded()) {
      this.map.setCenter(new google.maps.LatLng(lat, lng));
      this.map.setZoom(zoom);
    }
  }
}
