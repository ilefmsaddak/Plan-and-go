/// <reference types="leaflet" />
import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { environment } from '../../environment/env';
import { Place } from '../../models/interfaces';
import { PlacesService } from '../../services/places.service';
import * as L from 'leaflet';
import { NgZone } from '@angular/core';

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

  map!: L.Map;
  private markers: L.Marker[] = [];
  private mapReady: boolean = false;

  constructor(private placesService: PlacesService, private zone: NgZone) { }

  ngOnChanges(changes: SimpleChanges) {
    // Lorsque les places changent, les ajouter à la carte
    if (changes['places']) {
      const newPlaces = changes['places'].currentValue || [];

      if (this.mapReady) {
        console.log('📍 Places received (map ready):', newPlaces.length);
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
          if (this.mapReady) {
            console.log('📍 Places received (retry ' + retries + '):', placesToAdd.length);
            this.clearMarkers();
            if (placesToAdd.length > 0) {
              this.addCustomMarkers(placesToAdd);
            }
          } else if (retries < maxRetries) {
            setTimeout(tryAddMarkers, 100);
          } else {
            console.error('❌ Map failed to initialize after 3 seconds');
          }
        };

        tryAddMarkers();
      }
    }
  }

  ngAfterViewInit(): void {
    console.log('🗺️ GoogleMaps component initialized with Leaflet');
    // Ensure the map initialization happens in a safe context
    this.zone.runOutsideAngular(() => {
        this.initMap();
    });
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
  }

  private addCustomMarkers(places: Place[]) {
    console.log(`🎯 Adding ${places.length} markers to map`);
    let addedCount = 0;
    
    places.forEach((place, index) => {
      try {
        const lat = place.coordinates?.lat;
        const lng = place.coordinates?.lng;

        // Double-check coordinates (should already be validated in service)
        if (!isFinite(lat) || !isFinite(lng)) {
          console.warn(`⚠️ Place ${index} (${place.name}) has invalid coordinates`);
          return;
        }
        
        // Créer le marqueur avec icône personnalisée
        const marker = L.marker(
          [lat, lng],
          {
            icon: this.createCustomIcon(place.type),
            title: place.name
          }
        );

        // Créer le contenu du popup avec les détails du lieu
        const popupContent = this.createPopupContent(place);
        
        // Attacher le popup au marqueur
        marker.bindPopup(popupContent, {
          maxWidth: 350,
          className: 'place-popup',
          closeButton: true
        });

        // Ajouter le marqueur à la carte
        marker.addTo(this.map);
        
        // Ajouter le marqueur au tableau pour tracking
        this.markers.push(marker);
        addedCount++;
        
        if ((index + 1) % 50 === 0) {
          console.log(`  ... ${index + 1}/${places.length} markers added`);
        }
      } catch (error) {
        console.error(`❌ Error adding marker at index ${index}:`, error, place);
      }
    });

    console.log(`✅ Successfully added ${addedCount}/${places.length} markers`);

    // Ajuster les limites de la carte pour montrer tous les marqueurs
    if (this.markers.length > 0) {
      console.log(`🔍 Fitting map bounds to show ${this.markers.length} markers`);
      this.fitMapBounds();
    }
  }

  private createPopupContent(place: Place): string {
    // Sélectionner l'image
    const photoUrl = place.photos && place.photos.length > 0
      ? place.photos[0]
      : 'https://via.placeholder.com/320x200?text=No+Image';

    // Formater les avis
    const reviewText = place.reviews > 0 ? `(${place.reviews} avis)` : '(Pas d\'avis)';
    const stars = this.getStars(place.rating);

    // Construire le contenu HTML du popup
    return `
      <div class="leaflet-popup-content-wrapper place-info">
        <div class="place-header" style="position: relative; margin: -12px -12px 0 -12px; background: #f5f5f5;">
          <img 
            src="${photoUrl}" 
            alt="${place.name}" 
            style="
              width: 100%; 
              height: 180px; 
              object-fit: cover; 
              display: block;
              border-radius: 3px 3px 0 0;
            "
            onerror="this.src='https://via.placeholder.com/320x200?text=No+Image'"
          />
          <div style="
            position: absolute; 
            top: 10px; 
            right: 10px; 
            background: rgba(255, 255, 255, 0.95); 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 11px; 
            font-weight: 600; 
            color: #667eea; 
            text-transform: uppercase;
            backdrop-filter: blur(4px);
          ">
            ${this.getPlaceTypeLabel(place.type)}
          </div>
        </div>
        <div style="padding: 16px;">
          <h3 style="
            margin: 0 0 8px 0; 
            color: #2c3e50; 
            font-size: 16px; 
            font-weight: 600;
            word-break: break-word;
          ">
            ${place.name}
          </h3>
          <p style="
            margin: 0 0 10px 0; 
            color: #7f8c8d; 
            font-size: 13px; 
            line-height: 1.5;
            word-break: break-word;
          ">
            📍 ${place.address}
          </p>
          <div style="
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 12px;
            font-size: 13px;
          ">
            <span style="color: #ffc107; letter-spacing: 1px;">${stars}</span>
            <span style="color: #95a5a6;">${place.rating}/5</span>
            <span style="color: #bdc3c7;">•</span>
            <span style="color: #7f8c8d;">${reviewText}</span>
          </div>
          ${place.phoneNumber ? `
            <p style="margin: 8px 0; color: #2c3e50; font-size: 12px;">
              📞 <a href="tel:${place.phoneNumber}" style="color: #667eea; text-decoration: none;">
                ${place.phoneNumber}
              </a>
            </p>
          ` : ''}
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 12px;
          ">
            <button onclick="alert('Route calculation coming soon!')" style="
              padding: 8px 12px;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 600;
              transition: all 0.2s;
            " onmouseover="this.style.background='#764ba2'" onmouseout="this.style.background='#667eea'">
              🗺️ Itinéraire
            </button>
            <button onclick="alert('Saved to favorites!')" style="
              padding: 8px 12px;
              background: #f39c12;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 600;
              transition: all 0.2s;
            " onmouseover="this.style.background='#e67e22'" onmouseout="this.style.background='#f39c12'">
              ⭐ Ajouter
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private getPlaceTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      site: 'Site',
      hotel: 'Hôtel',
      food: 'Restaurant',
      cafe: 'Café',
      shop: 'Magasin',
      transports: 'Transport'
    };
    return typeLabels[type] || 'Lieu';
  }

  private createCustomIcon(type: string): L.DivIcon {
    const emojiMap: { [key: string]: string } = {
      site: '📷',      // Appareil photo pour les sites touristiques
      hotel: '🏨',     // Hôtel
      food: '🍽️',      // Restaurant
      cafe: '☕',      // Café
      shop: '🛍️',      // Magasin
      transports: '🚌' // Transports
    };

    const colorMap: { [key: string]: string } = {
      site: '#4285f4',      // Bleu (Google Blue)
      hotel: '#34a853',     // Vert (Google Green)
      food: '#fbbc05',      // Orange/Jaune (Google Yellow)
      cafe: '#ea4335',      // Rouge (Google Red)
      shop: '#f39c12',      // Orange
      transports: '#ff6d00' // Orange foncé
    };

    const emoji = emojiMap[type] || '📍';
    const color = colorMap[type] || '#667eea';

    // Créer un HTML pour l'icône avec une meilleure apparence
    const html = `
      <div style="
        background: white;
        border: 3px solid ${color};
        border-radius: 50%;
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: 
          0 2px 4px rgba(0, 0, 0, 0.2),
          0 0 0 2px rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      " class="marker-icon">
        ${emoji}
      </div>
    `;

    const icon = L.divIcon({
      html: html,
      iconSize: [42, 42],           // Taille de l'icône
      iconAnchor: [21, 42],         // Point d'ancrage (bas du cercle)
      popupAnchor: [0, -42],        // Décalage du popup par rapport au marqueur
      className: 'custom-marker'     // Classe CSS pour les animations
    });
    
    return icon;
  }

  private fitMapBounds() {
    if (this.markers.length === 0) {
      console.warn('⚠️ No markers to fit bounds');
      return;
    }

    try {
      // Créer les limites manuellement en itérant sur les marqueurs
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      let validMarkerCount = 0;

      this.markers.forEach(marker => {
        const latLng = marker.getLatLng();
        if (latLng && isFinite(latLng.lat) && isFinite(latLng.lng)) {
          minLat = Math.min(minLat, latLng.lat);
          maxLat = Math.max(maxLat, latLng.lat);
          minLng = Math.min(minLng, latLng.lng);
          maxLng = Math.max(maxLng, latLng.lng);
          validMarkerCount++;
        }
      });

      if (validMarkerCount === 0) {
        console.error('❌ No valid marker coordinates found');
        return;
      }

      // Créer les bounds à partir des coordonnées valides
      const bounds = L.latLngBounds(
        [minLat, minLng], // Southwest
        [maxLat, maxLng]  // Northeast
      );

      console.log(`📍 Bounds calculated from ${validMarkerCount}/${this.markers.length} markers`);
      console.log(`   SW: [${minLat.toFixed(4)}, ${minLng.toFixed(4)}]`);
      console.log(`   NE: [${maxLat.toFixed(4)}, ${maxLng.toFixed(4)}]`);
      
      // Ajouter du padding pour mieux voir les marqueurs
      this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
      console.log('✅ Map bounds fitted to markers with maxZoom: 14');
    } catch (error) {
      console.error('❌ Error fitting map bounds:', error);
      // Fallback : centrer sur Istanbul
      this.map.setView([41.0082, 28.9784], 12);
    }
  }

  private getStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

 private initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('❌ Map element not found');
      return;
    }

    try {
      // 1. Créer la carte Leaflet avec OpenStreetMap
      this.map = L.map('map').setView([41.0082, 28.9784], 12);

      // 2. Ajouter le tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // 3. Defer the map sizing correction to the next browser repaint/tick
      // This is the CRITICAL change for Angular/Leaflet integration
      setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize(); 
            console.log('✨ Map size validated AFTER DOM render.');
          }
      }, 50); // A small delay to ensure CSS has been applied

      // Initialiser le PlacesService
      console.log('🔧 Initializing PlacesService');
      this.placesService.initializeService(this.map);

      // Ajouter les marqueurs personnalisés APRÈS la création de la carte
      if (this.places.length > 0) {
        console.log('📍 Adding ' + this.places.length + ' initial markers');
        this.addCustomMarkers(this.places);
      }

      // Marquer la carte comme prête
      this.mapReady = true;
      console.log('✅ Map initialization complete');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
  }

  calculateAndDisplayRoute() {
    // Fonctionnalité de calcul de route - Non implémentée pour Leaflet
    console.warn('⚠️ Route calculation not yet implemented with Leaflet');
  }

  // Méthode pour effacer tous les marqueurs (peut être appelée depuis l'extérieur)
  public clearAllMarkers() {
    this.clearMarkers();
  }

  // Méthode pour centrer la carte sur un lieu spécifique
  public centerOnLocation(lat: number, lng: number, zoom: number = 15) {
    if (this.map) {
      this.map.setView([lat, lng], zoom);
    }
  }
}
