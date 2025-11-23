from mongoengine import Document, EmbeddedDocument, fields
from datetime import datetime

# Embedded document for a place in the bucket
class Place(EmbeddedDocument):
    id = fields.StringField(required=True)
    name = fields.StringField(required=True)

# Embedded document for itinerary items
class ItineraryItem(EmbeddedDocument):
    day_index = fields.IntField(required=True)
    date = fields.DateTimeField(required=True)
    places = fields.EmbeddedDocumentListField(Place)  
# Main Trip document
class Trip(Document):
    author_id = fields.StringField(required=True)
    author_name = fields.StringField(required=True)
    created_at = fields.DateTimeField(default=datetime.utcnow)
    city = fields.StringField(required=True)
    from_date = fields.DateTimeField(required=True)
    to_date = fields.DateTimeField(required=True)
    is_public = fields.BooleanField(default=True)
    
    place_bucket = fields.EmbeddedDocumentListField(Place)
    itinerary = fields.EmbeddedDocumentListField(ItineraryItem)
    meta = {"collection": "plans"} 
