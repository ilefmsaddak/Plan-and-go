# views.py
import bucket.db  # ensures MongoEngine connects
from datetime import datetime
from django.http import JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt


import traceback
import sys

from social.models import Plan, ItineraryDay, Place

DATE_FORMATS = ["%d/%m/%Y", "%Y-%m-%d"]

def parse_date_flexible(date_str):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            continue
    raise ValueError(f"Date '{date_str}' does not match supported formats: {DATE_FORMATS}")

@csrf_exempt
def save_itinerary_view(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Invalid request method"}, status=405)

    try:
        # log raw body for debugging
        raw = request.body.decode("utf-8", errors="replace")

        data = json.loads(raw)
        trip_id = data.get("tripId")
        days = data.get("days")

        if not trip_id:
            return JsonResponse({"status": "error", "message": "Missing tripId"}, status=400)
        if not isinstance(days, list) or len(days) == 0:
            return JsonResponse({"status": "error", "message": "Missing or invalid 'days' (must be non-empty list)"}, status=400)

        trip = Plan.objects(id=trip_id).first()
        if not trip:
            return JsonResponse({"status": "error", "message": "Trip not found"}, status=404)

        # Reset itinerary
        trip.itinerary = []

        for i, day in enumerate(days):
            # validate day object
            if not isinstance(day, dict):
                return JsonResponse({"status":"error","message":f"Each day must be an object (index {i})"}, status=400)

            date_raw = day.get("date")
            if not date_raw:
                return JsonResponse({"status":"error","message":f"Missing 'date' for day index {i}"}, status=400)

            # parse date with flexible formats
            try:
                parsed_date = parse_date_flexible(str(date_raw))
            except ValueError as ve:
                return JsonResponse({"status":"error","message":str(ve)}, status=400)

            places_input = day.get("places", [])
            if not isinstance(places_input, list):
                return JsonResponse({"status":"error","message":f"'places' must be a list for day index {i}"}, status=400)

            place_objs = []
            for j, p in enumerate(places_input):
                if not isinstance(p, dict):
                    return JsonResponse({"status":"error","message":f"Place at day {i} index {j} must be an object"}, status=400)
                pid = p.get("id") or p.get("placeId")
                pname = p.get("name") or p.get("placeName")
                if not pid or not pname:
                    return JsonResponse({"status":"error","message":f"Place at day {i} index {j} is missing 'id' or 'name' (got keys: {list(p.keys())})"}, status=400)

                # Only id + name because your Place model does not have 'type'
                place_objs.append(Place(id=str(pid), name=str(pname)))

            itinerary_item = ItineraryDay(
                day_index=i,
                date=parsed_date,
                places=place_objs
            )
            trip.itinerary.append(itinerary_item)

        trip.save()

        result = {
            "status": "success",
            "itinerary": [
                {
                    "day_index": item.day_index,
                    "date": item.date.strftime("%d/%m/%Y"),
                    "places": [{"id": p.id, "name": p.name} for p in item.places]
                }
                for item in trip.itinerary
            ]
        }
        return JsonResponse(result)

    except Exception as e:
        print("EXCEPTION in save_itinerary_view:", file=sys.stderr)
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
