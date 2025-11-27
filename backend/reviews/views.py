import os
from dotenv import load_dotenv
import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response
import logging

# Gemini
import google.generativeai as genai

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

@api_view(['GET'])
def get_place_reviews(request):
    """Fetch reviews from SerpApi using Google Maps query"""
    place_id = request.GET.get("place_id")
    query = request.GET.get("query")  # e.g., restaurant name + location

    if not place_id and not query:
        return Response({"error": "place_id or query required"}, status=400)

    try:
        # Use Google Maps integration in SerpApi
        url = "https://serpapi.com/search"
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_maps",
            "type": "search",
        }
        
        # If we have place_id, try to get details directly
        if place_id:
            params["place_id"] = place_id
            params["type"] = "place"
        else:
            params["q"] = query

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        serpapi_data = response.json()
        
        # Extract reviews - check different possible keys
        reviews = (
            serpapi_data.get("reviews", []) or
            serpapi_data.get("place", {}).get("reviews", []) or
            []
        )
        
        logger.info(f"Successfully fetched {len(reviews)} reviews for place_id: {place_id}")
        
        return Response({
            "reviews": reviews,
            "place_id": place_id,
            "review_count": len(reviews),
            "raw_response": serpapi_data  # For debugging
        })
    
    except requests.exceptions.Timeout:
        logger.error(f"SerpApi request timed out for place_id: {place_id}")
        return Response({"error": "Request timed out"}, status=504)
    except requests.exceptions.RequestException as e:
        logger.error(f"SerpApi request failed: {str(e)}")
        return Response({"error": f"Failed to fetch reviews: {str(e)}"}, status=502)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return Response({"error": "Internal server error"}, status=500)


@api_view(['POST'])
def summarize_reviews(request):
    """Summarize reviews using Gemini AI"""
    try:
        reviews_data = request.data
        
        # Handle both direct reviews list and SerpApi response format
        if isinstance(reviews_data, list):
            reviews = reviews_data
        else:
            reviews = reviews_data.get("reviews", [])

        if not reviews:
            return Response({"error": "No reviews found"}, status=400)

        # Extract review texts from SerpApi format
        texts = []
        for review in reviews:
            if isinstance(review, dict):
                # SerpApi format: review has 'review' key
                review_text = review.get("review") or review.get("text", "")
                if review_text:
                    texts.append(review_text)
            elif isinstance(review, str):
                texts.append(review)

        if not texts:
            return Response({"error": "No review text found"}, status=400)

        combined = "\n\n".join(texts)

        prompt = (
            "Summarize these reviews in a few short sentences. "
            "Focus only on the main opinions, strengths, weaknesses, and recurring themes. "
            "Keep it concise and clear, no more than 40 words:\n\n" + combined
        )

        # Gemini AI call
        model = genai.GenerativeModel("models/gemini-2.5-pro")
        ai_response = model.generate_content(prompt)

        summary = ai_response.text

        return Response({
            "summary": summary,
            "review_count": len(reviews),
            "text_count": len(texts)
        })
    
    except Exception as e:
        logger.error(f"Error in summarize_reviews: {str(e)}")
        return Response({"error": f"Failed to summarize: {str(e)}"}, status=500)
