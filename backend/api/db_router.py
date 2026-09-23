"""Keep sensor telemetry in its configured database without moving accounts."""
from django.conf import settings


class SensorReadingRouter:
    def db_for_read(self, model, **hints):
        if model._meta.label_lower == 'api.sensorreading' and 'sensors' in settings.DATABASES:
            return 'sensors'
        return None

    db_for_write = db_for_read

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if 'sensors' not in settings.DATABASES:
            return None
        is_sensor = app_label == 'api' and model_name == 'sensorreading'
        if db == 'sensors':
            return is_sensor
        if is_sensor:
            return False
        return None
