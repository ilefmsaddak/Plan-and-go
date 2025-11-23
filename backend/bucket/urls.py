from django.urls import path
from .views import save_itinerary_view

urlpatterns = [
    path('add/', save_itinerary_view, name='save_itinerary_view'),
]
