from django.conf import settings
from rest_framework.permissions import BasePermission


class HostedAccountRequired(BasePermission):
    """Keep public hosting's scan/provider endpoints behind the app login."""
    message = 'Sign in to analyze images or request recommendations.'

    def has_permission(self, request, view):
        return not getattr(settings, 'API_REQUIRE_LOGIN', False) or bool(request.user and request.user.is_authenticated)
