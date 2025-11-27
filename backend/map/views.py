from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import requests
import os
import logging

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def proxy_serpapi(request):
    """
    Proxy endpoint pour SerpApi - contourne les blocages CORS
    
    Exemple d'utilisation:
    GET /map/proxy/serpapi/?type=search&q=restaurant&ll=40.7128,-74.0060&radius=5
    """
    
    # Gérer les requêtes OPTIONS (CORS preflight)
    if request.method == 'OPTIONS':
        response = JsonResponse({'status': 'ok'})
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        response['Access-Control-Max-Age'] = '3600'
        return response
    
    try:
        # Récupérer la clé API depuis les variables d'environnement
        serpapi_key = os.getenv('SERPAPI_KEY')
        
        if not serpapi_key:
            logger.error('SERPAPI_KEY not found in environment variables')
            response = JsonResponse({
                'error': 'SerpApi key is required',
                'places': []
            }, status=400)
            response['Access-Control-Allow-Origin'] = '*'
            return response
        
        # Récupérer tous les paramètres de la requête SAUF 'api_key'
        params = {}
        for key, value in request.GET.items():
            if key != 'api_key':  # Ne pas copier la clé depuis la requête
                params[key] = value
        
        # Ajouter la clé API
        params['api_key'] = serpapi_key
        
        # Si type=search, utiliser Google Local Search (pas Google Search)
        if params.get('type') == 'search' and 'll' in params:
            # Transformer en requête Google Local Search
            params['engine'] = 'google_local'
            del params['type']
            
            # Transformer 'radius' en mètres si en km
            if 'radius' in params:
                try:
                    radius_km = float(params['radius'])
                    # Si radius est petit (< 50), c'est probablement en km
                    if radius_km < 50:
                        params['radius'] = int(radius_km * 1000)  # Convertir km en mètres
                except ValueError:
                    pass
        
        logger.info(f"SerpApi request: engine={params.get('engine')}, q={params.get('q')}, ll={params.get('ll')}")
        
        # Effectuer la requête à SerpApi avec retry et timeout augmenté
        try:
            max_retries = 2
            serpapi_response = None
            
            for attempt in range(max_retries):
                try:
                    logger.info(f"SerpApi attempt {attempt + 1}/{max_retries}")
                    serpapi_response = requests.get(
                        'https://serpapi.com/search', 
                        params=params, 
                        timeout=30  # Augmenté de 10 à 30 secondes
                    )
                    serpapi_response.raise_for_status()
                    break  # Succès, sortir de la boucle
                except requests.exceptions.Timeout:
                    logger.warning(f"Timeout on attempt {attempt + 1}, retrying...")
                    if attempt == max_retries - 1:
                        raise
            
            # Transformer la réponse SerpApi en format attendu par le frontend
            serpapi_data = serpapi_response.json()
            
            # Extraire les places selon le type de réponse
            places = []
            
            # Format Google Local Search (engine=google_local)
            if 'results' in serpapi_data:
                places = serpapi_data.get('results', [])
                logger.info(f"Using google_local results: {len(places)} items")
            # Format Google Search (engine=google)
            elif 'local_results' in serpapi_data:
                places = serpapi_data.get('local_results', [])
                logger.info(f"Using local_results: {len(places)} items")
            # Format Organic Search
            elif 'organic_results' in serpapi_data:
                places = serpapi_data.get('organic_results', [])
                logger.info(f"Using organic_results: {len(places)} items")
            
            logger.info(f"SerpApi returned {len(places)} results")
            
            # Normaliser les données pour le frontend
            normalized_places = []
            for place in places:
                try:
                    # Extraire les coordonnées - différents formats selon la source
                    latitude = place.get('latitude') or place.get('lat')
                    longitude = place.get('longitude') or place.get('lng')
                    
                    # Convertir en float si nécessaire
                    if latitude is not None and longitude is not None:
                        try:
                            latitude = float(latitude)
                            longitude = float(longitude)
                        except (ValueError, TypeError):
                            latitude = None
                            longitude = None
                    
                    # Si les coordonnées ne sont pas présentes, essayer de les extraire de la géométrie
                    if not latitude or not longitude:
                        geo = place.get('gps_coordinates', {}) or place.get('coordinates', {})
                        if geo:
                            try:
                                latitude = float(geo.get('latitude', 0))
                                longitude = float(geo.get('longitude', 0))
                            except (ValueError, TypeError):
                                latitude = None
                                longitude = None
                    
                    # Convertir rating en float
                    try:
                        rating = float(place.get('rating', 0)) if place.get('rating') else 0
                    except (ValueError, TypeError):
                        rating = 0
                    
                    # Convertir review_count en int
                    try:
                        review_count = int(place.get('review_count', 0)) if place.get('review_count') else 0
                    except (ValueError, TypeError):
                        review_count = 0
                    
                    # Créer la place normalisée uniquement si elle a des coordonnées valides
                    if latitude and longitude:
                        # Extraire l'image - différents champs possibles
                        image = place.get('image') or place.get('thumbnail') or place.get('photo') or ''
                        
                        normalized_place = {
                            'place_id': str(place.get('place_id', place.get('link', ''))),
                            'title': str(place.get('title', place.get('name', ''))),
                            'description': str(place.get('description', place.get('snippet', place.get('type', '')))),
                            'address': str(place.get('address', '')),
                            'latitude': latitude,
                            'longitude': longitude,
                            'rating': rating,
                            'review_count': review_count,
                            'image': str(image),
                            'phone': str(place.get('phone', place.get('review_snippets', ''))),
                            'website': str(place.get('website', place.get('link', '')))
                        }
                        normalized_places.append(normalized_place)
                except Exception as place_error:
                    logger.warning(f"Error processing place: {place_error}")
                    continue
            
            # Créer la réponse avec le format attendu
            result_data = {
                'places': normalized_places,
                'search_metadata': serpapi_data.get('search_metadata', {}),
                'search_parameters': serpapi_data.get('search_parameters', {})
            }
            
            result = JsonResponse(result_data)
            result['Access-Control-Allow-Origin'] = '*'
            result['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            result['Access-Control-Allow-Headers'] = 'Content-Type'
            
            return result
            
        except requests.exceptions.Timeout:
            logger.error('SerpApi request timed out after retries')
            response = JsonResponse({
                'error': 'SerpApi request timed out',
                'places': []
            }, status=504)
            response['Access-Control-Allow-Origin'] = '*'
            return response
            
        except requests.exceptions.RequestException as e:
            logger.error(f'SerpApi request failed: {str(e)}')
            response = JsonResponse({
                'error': f'SerpApi request failed: {str(e)}',
                'places': []
            }, status=502)
            response['Access-Control-Allow-Origin'] = '*'
            return response
            
    except Exception as e:
        logger.exception(f'Proxy error: {str(e)}')
        response = JsonResponse({
            'error': f'Proxy error: {str(e)}',
            'places': []
        }, status=500)
        response['Access-Control-Allow-Origin'] = '*'
        return response

