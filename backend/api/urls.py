from django.urls import path
from . import views
from .prediction_stats import leaf_scan_stats

urlpatterns = [
    path('', views.api_root),
    path('csrf/', views.csrf_token),
    path('password/change/', views.change_password),
    path('me/', views.me),
    path('sensors/', views.sensors),
    path('sensors/history/', views.sensor_history),
    path('predictions/history/', views.prediction_history),
    path('predictions/leaf-stats/', leaf_scan_stats),
    path('nlp/summary/', views.nlp_summary),
    path('disease-recommendation/', views.disease_recommendation),
    path('telemetry/', views.telemetry),
    path('leaf_diseases/', views.leaf_diseases),
    path('predict_leaf/', views.predict_leaf),
    path('predict_rambutan/', views.predict_rambutan),
    path('confirm_prediction/', views.confirm_prediction),
    path('signup/', views.signup),
    path('auth/google/', views.google_auth),
    path('ping', views.ping),
    path('login', views.login),
    path('logout', views.logout_view),
    path('weather/', views.weather),
    path('otp/request/', views.otp_request),
    path('otp/verify/', views.otp_verify),
    path('password_reset/request/', views.password_reset_request),
    path('password_reset/confirm/', views.password_reset_confirm),
]
