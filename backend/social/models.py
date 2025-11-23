from django.db import models
from mongoengine import fields, Document, StringField, IntField, DateTimeField, ListField, ReferenceField, BooleanField, DictField, EmbeddedDocument, EmbeddedDocumentField, EmailField, ObjectIdField
from datetime import datetime
import bcrypt
import uuid

class Reply(EmbeddedDocument):
    """Réponse à un commentaire"""
    id = StringField(required=True)
    author_id = StringField(required=True)
    author_name = StringField()
    text = StringField(required=True)
    created_at = DateTimeField(default=datetime.utcnow)

class Reaction(EmbeddedDocument):
    """Réaction à un commentaire"""
    id = StringField(required=True)
    author_id = StringField(required=True)
    author_name = StringField()
    type = StringField(required=True)  # emoji type (👍, ❤️, etc.)
    created_at = DateTimeField(default=datetime.utcnow)

class Comment(EmbeddedDocument):
    """Commentaire sur un plan"""
    id = StringField(required=True)
    author_id = StringField(required=True)
    author_name = StringField()
    text = StringField(required=True)
    replies = ListField(EmbeddedDocumentField(Reply), default=[])  # Réponses au commentaire
    reactions = ListField(EmbeddedDocumentField(Reaction), default=[])  # Réactions au commentaire
    created_at = DateTimeField(default=datetime.utcnow)

class Like(EmbeddedDocument):
    """Like sur un plan"""
    user_id = StringField(required=True)
    user_name = StringField()  # Nom d'utilisateur pour affichage
    created_at = DateTimeField(default=datetime.utcnow)

class Place(EmbeddedDocument):
    """Lieu à visiter dans le plan"""
    id = StringField(required=True)
    name = StringField(required=True)

class ItineraryDay(EmbeddedDocument):
    """Jour d'itinéraire avec places à visiter"""
    day_index = IntField(required=True)
    date = DateTimeField(required=True)
    places = ListField(StringField(), default=[])  # IDs des places du place_bucket

class Plan(Document):
    """Plan de voyage avec itinéraire détaillé"""
    author_id = StringField(required=True)
    author_name = StringField(required=True)
    created_at = DateTimeField(default=datetime.utcnow)
    
    city = StringField(required=True)
    from_date = DateTimeField(required=True)  # Date de début
    to_date = DateTimeField(required=True)    # Date de fin
    
    is_public = BooleanField(default=False)  # True = partagé, False = privé
    
    place_bucket = fields.EmbeddedDocumentListField(Place, default=[])  # Catalogue des places
    itinerary = fields.EmbeddedDocumentListField(ItineraryDay, default=[])  # Itinéraire par jour
    
    cloned_from = StringField()  # ID de l'auteur original si c'est un clone
    cloned_from_plan_id = StringField()  # ID du plan original si c'est un clone
    
    meta = {
        "collection": "plans",
        "ordering": ["-created_at"],
    }

    def get_duration_days(self):
        """Retourne le nombre de jours du plan"""
        if self.from_date and self.to_date:
            delta = self.to_date - self.from_date
            return delta.days + 1
        return 0

class PlanSnapshot(EmbeddedDocument):
    """Snapshot du plan au moment du partage"""
    city = StringField()
    from_date = DateTimeField()
    to_date = DateTimeField()
    place_bucket = ListField(EmbeddedDocumentField(Place), default=[])
    itinerary = ListField(EmbeddedDocumentField(ItineraryDay), default=[])

class Publication(Document):
    """Publication d'un plan partagé"""
    shared_plan_id = StringField(required=True)  # Référence vers Plan._id
    author_id = StringField(required=True)
    author_name = StringField(required=True)
    description = StringField()
    created_at = DateTimeField(default=datetime.utcnow)
    
    # Snapshot du plan au moment du partage
    plan_snapshot = EmbeddedDocumentField(PlanSnapshot)
    
    # Likes
    likes = ListField(EmbeddedDocumentField(Like), default=[])
    
    # Commentaires
    comments = ListField(EmbeddedDocumentField(Comment), default=[])
    
    # Clonage
    cloned_by = ListField(StringField(), default=[])  # IDs des utilisateurs qui ont cloné
    
    meta = {
        "collection": "publications",
        "ordering": ["-created_at"],
    }

class Notification(Document):
    """Notification pour un utilisateur"""
    recipient_id = StringField(required=True)
    sender_id = StringField(required=True)
    sender_name = StringField()
    action_type = StringField(required=True)  # 'like', 'comment', 'clone'
    pub_id = StringField()  # ID de la publication
    description = StringField()  # Description de la publication
    message = StringField()
    is_read = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "notifications",
        "ordering": ["-created_at"],
    }

class UserProfile(Document):
    """Profil utilisateur"""
    user_id = StringField(required=True, unique=True)
    username = StringField(required=True)
    email = StringField()
    bio = StringField()
    avatar_url = StringField()
    followers = ListField(StringField(), default=[])
    following = ListField(StringField(), default=[])
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "user_profiles",
    }


class User(Document):
    """Utilisateur de la plateforme"""
    userId = StringField(required=True, unique=True)  # user_001, user_002, etc.
    username = StringField(required=True, unique=True)
    email = EmailField(required=True, unique=True)
    passwordHash = StringField(required=True)
    bio = StringField(default="")
    avatarUrl = StringField(default="")
    isActive = BooleanField(default=True)
    createdAt = DateTimeField(default=datetime.utcnow)
    updatedAt = DateTimeField(default=datetime.utcnow)
    lastLoginAt = DateTimeField()

    meta = {
        "collection": "users",
        "indexes": ["userId", "email", "username"]
    }

    def set_password(self, password):
        """Hasher le mot de passe"""
        salt = bcrypt.gensalt()
        self.passwordHash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        """Vérifier le mot de passe"""
        return bcrypt.checkpw(password.encode('utf-8'), self.passwordHash.encode('utf-8'))
