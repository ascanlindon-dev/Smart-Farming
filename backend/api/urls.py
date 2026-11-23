from django.urls import path
from . import views
from .harvest_records import harvest_records
from .prediction_stats import leaf_scan_stats
from .prediction_transactions import prediction_image, prediction_transactions
from .sensor_readings import sensor_readings

urlpatterns = [
    path('', views.api_root),
    path('csrf/', views.csrf_token),
    path('password/change/', views.change_password),
    path('me/', views.me),
    path('consent/', views.user_consent, name='user-consent'),
    path('consent/withdraw/', views.withdraw_user_consent, name='withdraw-user-consent'),
    path('admin/consents/', views.admin_user_consents, name='admin-user-consents'),
    path('sensors/', views.sensors),
    path('sensors/history/', views.sensor_history),
    path('sensors/readings/', sensor_readings),
    path('predictions/history/', views.prediction_history),
    path('predictions/transactions/', prediction_transactions),
    path('predictions/<int:prediction_id>/image/', prediction_image),
    path('predictions/leaf-stats/', leaf_scan_stats),
    path('maturity/harvest-records/', harvest_records),
    path('nlp/summary/', views.nlp_summary),
    path('disease-recommendation/', views.disease_recommendation),
    path('telemetry/', views.telemetry),
    path('leaf_diseases/', views.leaf_diseases),
    path('predict_leaf/', views.predict_leaf),
    path('predict_rambutan/', views.predict_rambutan),
    path('confirm_prediction/', views.confirm_prediction),
    path('signup/', views.signup),
    path('auth/google/', views.google_auth),
    path('ping/', views.ping, name='ping'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout_view, name='logout'),
    # Keep older clients working without redirecting POST bodies.
    path('ping', views.ping),
    path('login', views.login),
    path('logout', views.logout_view),
    path('weather/', views.weather),
    path('otp/request/', views.otp_request),
    path('otp/verify/', views.otp_verify),
    path('password_reset/request/', views.password_reset_request),
    path('password_reset/confirm/', views.password_reset_confirm),
]
