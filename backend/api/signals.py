from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import (
	Alert,
	DiseaseDetection,
	EnvironmentalReading,
	MaturityDetection,
	SensorStatus,
	SystemLog,
	WeatherForecast,
)


def _log_saved(instance, created, **kwargs):
	farmer = getattr(instance, 'farmer', None)
	SystemLog.objects.create(
		farmer=farmer,
		action='create' if created else 'update',
		entity=instance.__class__.__name__,
		message=f'{instance.__class__.__name__} record {"created" if created else "updated"}',
	)


def _log_deleted(instance, **kwargs):
	farmer = getattr(instance, 'farmer', None)
	SystemLog.objects.create(
		farmer=farmer,
		action='delete',
		entity=instance.__class__.__name__,
		message=f'{instance.__class__.__name__} record deleted',
	)


for _model in (EnvironmentalReading, WeatherForecast, DiseaseDetection, MaturityDetection, Alert, SensorStatus):
	post_save.connect(_log_saved, sender=_model, dispatch_uid=f'log_{_model.__name__.lower()}_saved')
	post_delete.connect(_log_deleted, sender=_model, dispatch_uid=f'log_{_model.__name__.lower()}_deleted')