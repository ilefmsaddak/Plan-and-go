import os
from dotenv import load_dotenv
import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response

# Gemini
import google.generativeai as genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

@api_view(['GET'])
def get_place_reviews(request):
    place_id = request.GET.get("place_id")

    if not place_id:
        return Response({"error": "place_id missing"}, status=400)

    url = (
        f"https://maps.googleapis.com/maps/api/place/details/json?"
        f"place_id={place_id}&fields=reviews&key={GOOGLE_API_KEY}"
    )

    google_response = requests.get(url).json()
    return Response(google_response)


@api_view(['POST'])
def summarize_reviews(request):
    google_json = request.data

    # Extract reviews
    reviews = google_json.get("result", {}).get("reviews", [])

    if not reviews:
        return Response({"error": "No reviews found in JSON"}, status=400)

    # Extract review texts
    texts = [r.get("text", "") for r in reviews]
    combined = "\n\n".join(texts)

    prompt = (
    "Summarize these Google Maps reviews in a few short sentences. "
    "Focus only on the main opinions, strengths, weaknesses, and recurring themes. "
    "Keep it concise and clear no more then 40 words:\n\n" + combined
)


    # Gemini AI call
    model = genai.GenerativeModel("models/gemini-2.5-pro")
    ai_response = model.generate_content(prompt)

    summary = ai_response.text

    return Response({
        "summary": summary,
        "count": len(reviews)
    })
