from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/reviews/', include('reviews.urls')),  # <-- link app URLs
    path('api/', include('social.urls')),
    path('bucket/', include('bucket.urls')),
]
