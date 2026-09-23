import os
import django
import sys
sys.path.append(r'C:\wamp64\www\Smart Farming System (1)')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend.settings')
django.setup()
from api.models import SensorReading
print('count=', SensorReading.objects.count())
last = SensorReading.objects.order_by('-id').first()
if last:
    print('last:', {'id': last.id, 'device_id': last.device_id, 'temperature': last.temperature, 'humidity': last.humidity, 'soil_raw': last.soil_raw, 'moisture_pct': last.moisture_pct, 'rain': last.rain, 'created_at': str(last.created_at)})
else:
    print('no rows')
