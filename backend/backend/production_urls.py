from django.urls import path, re_path

from .hosting_views import frontend, health
from .urls import urlpatterns as api_patterns

urlpatterns = [path('', frontend), path('healthz/', health)] + api_patterns + [
    # Browser navigation/refresh must reach React. API, admin, health and missing
    # asset requests keep their real responses instead of receiving index.html.
    re_path(r'^(?!(?:api|admin|healthz|static|assets)(?:/|$))[^.]+$', frontend),
]
