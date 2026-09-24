from django.urls import path

from .hosting_views import frontend, health
from .urls import urlpatterns as api_patterns

urlpatterns = [path('', frontend), path('healthz/', health)] + api_patterns
