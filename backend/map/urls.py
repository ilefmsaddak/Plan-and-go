from django.urls import path
from . import views

urlpatterns = [
    path('proxy/serpapi/', views.proxy_serpapi, name='proxy-serpapi'),
    
]
