from django.urls import path
from .views import get_place_reviews, summarize_reviews

urlpatterns = [
    path('', get_place_reviews, name='get_place_reviews'),
    path('sum/', summarize_reviews, name='summarize_reviews'),

]
