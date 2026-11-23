import uuid

from django.db import models

from django.contrib.auth.models import User

class Farmer(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE)
	location = models.CharField(max_length=200, blank=True)
	photo = models.URLField(blank=True)
	mobile = models.CharField(max_length=20, blank=True)

	def __str__(self):
		return self.user.username


class ConsentIdentity(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='consent_identity')

	class Meta:
		db_table = 'consent_identities'


class UserConsent(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(
		ConsentIdentity,
		db_column='user_id',
		on_delete=models.CASCADE,
		related_name='consents',
	)
	research_consent = models.BooleanField()
	privacy_consent = models.BooleanField()
	consent_version = models.TextField()
	agreed_at = models.DateTimeField()
	withdrawn_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		db_table = 'user_consents'
		ordering = ['-agreed_at']
		indexes = [
			models.Index(fields=['user', '-agreed_at'], name='uc_user_agreed_idx'),
		]


from django.db import models

# Create your models here.


class SensorReading(models.Model):
	device_id = models.CharField(max_length=64, blank=True)
	temperature = models.FloatField(null=True, blank=True)
	humidity = models.FloatField(null=True, blank=True)
	soil_raw = models.IntegerField(null=True, blank=True)
	moisture_pct = models.IntegerField(null=True, blank=True)
	rain = models.IntegerField(null=True, blank=True)
	is_raining = models.BooleanField(null=True, blank=True)
	received_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.device_id} @ {self.received_at}"


class Prediction(models.Model):
	user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
	prediction_type = models.CharField(max_length=32)  # 'leaf' or 'rambutan'
	label = models.CharField(max_length=128)
	confidence = models.FloatField()
	image_name = models.CharField(max_length=255, blank=True)
	raw_probs = models.TextField(blank=True)  # JSON string of probabilities
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.prediction_type}:{self.label} ({self.confidence:.3f}) @ {self.created_at}"


class WeatherCache(models.Model):
	requested_q = models.CharField(max_length=255)
	normalized_q = models.CharField(max_length=255, db_index=True)
	days = models.PositiveSmallIntegerField(default=7)
	payload = models.JSONField()
	fetched_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-fetched_at']
		indexes = [
			models.Index(fields=['normalized_q', '-fetched_at']),
		]

	def __str__(self):
		return f"{self.requested_q} ({self.days} days) @ {self.fetched_at}"


class DiseaseKnowledge(models.Model):
	"""Curated disease guidance; chemical data is stored only after FPA verification."""
	disease = models.CharField(max_length=100, unique=True)
	scientific_name = models.CharField(max_length=160, blank=True)
	symptoms = models.JSONField(default=list, blank=True)
	risk_factors = models.JSONField(default=list, blank=True)
	prevention = models.JSONField(default=list, blank=True)
	immediate_actions = models.JSONField(default=list, blank=True)
	cultural_control = models.JSONField(default=list, blank=True)
	treatment = models.JSONField(default=dict, blank=True)
	chemical_treatment = models.JSONField(default=dict, blank=True)
	safety = models.JSONField(default=list, blank=True)
	when_to_seek_help = models.TextField(blank=True)
	sources = models.JSONField(default=list, blank=True)
	verification_status = models.CharField(max_length=40, default='curated_nonchemical')
	last_verified = models.DateField(null=True, blank=True)

	def __str__(self):
		return self.disease


class EmailOTP(models.Model):
	PURPOSE_CHOICES = [
		('signup', 'Signup verification'),
		('login', 'Login verification'),
		('reset', 'Password reset'),
	]

	email = models.CharField(max_length=255, db_index=True)
	code = models.CharField(max_length=6)
	purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
	created_at = models.DateTimeField(auto_now_add=True)
	expires_at = models.DateTimeField()
	consumed = models.BooleanField(default=False)
	attempts = models.PositiveSmallIntegerField(default=0)

	def __str__(self):
		return f"{self.email} ({self.purpose}) @ {self.created_at}"


class EnvironmentalReading(models.Model):
	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='environmental_readings')
	device_id = models.CharField(max_length=64, blank=True)
	temperature_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
	humidity_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
	soil_moisture_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
	rainfall_mm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
	wind_speed_kph = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
	pressure_hpa = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
	is_raining = models.BooleanField(default=False)
	reading_at = models.DateTimeField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'environmental_readings'
		ordering = ['-reading_at']
		indexes = [
			models.Index(fields=['farmer', '-reading_at']),
			models.Index(fields=['device_id', '-reading_at']),
		]


class WeatherForecast(models.Model):
	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='weather_forecasts')
	location = models.CharField(max_length=255)
	forecast_date = models.DateField()
	condition = models.CharField(max_length=120, blank=True)
	temperature_min_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
	temperature_max_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
	rainfall_mm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
	precipitation_probability_pct = models.PositiveSmallIntegerField(null=True, blank=True)
	wind_speed_kph = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
	provider = models.CharField(max_length=80, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'weather_forecasts'
		ordering = ['forecast_date']
		constraints = [
			models.UniqueConstraint(fields=['farmer', 'forecast_date', 'location'], name='unique_farmer_forecast_day'),
		]
		indexes = [
			models.Index(fields=['farmer', 'forecast_date']),
			models.Index(fields=['location', 'forecast_date']),
		]


class DiseaseDetection(models.Model):
	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='disease_detections')
	image_name = models.CharField(max_length=255, blank=True)
	disease_label = models.CharField(max_length=128)
	confidence_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
	severity = models.CharField(max_length=32, blank=True)
	recommendation = models.TextField(blank=True)
	detected_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'disease_detections'
		ordering = ['-detected_at']
		indexes = [
			models.Index(fields=['farmer', '-detected_at']),
			models.Index(fields=['disease_label', '-detected_at']),
		]


class MaturityDetection(models.Model):
	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='maturity_detections')
	image_name = models.CharField(max_length=255, blank=True)
	maturity_label = models.CharField(max_length=64)
	confidence_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
	days_to_harvest = models.PositiveSmallIntegerField(null=True, blank=True)
	quality_grade = models.CharField(max_length=32, blank=True)
	recommendation = models.TextField(blank=True)
	detected_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'maturity_detections'
		ordering = ['-detected_at']
		indexes = [
			models.Index(fields=['farmer', '-detected_at']),
			models.Index(fields=['maturity_label', '-detected_at']),
		]


class Alert(models.Model):
	ALERT_TYPES = [('weather', 'Weather'), ('environmental', 'Environmental'), ('disease', 'Disease'), ('maturity', 'Maturity'), ('system', 'System')]
	SEVERITIES = [('info', 'Info'), ('moderate', 'Moderate'), ('high', 'High'), ('critical', 'Critical')]

	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='alerts')
	alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
	severity = models.CharField(max_length=10, choices=SEVERITIES, default='info')
	title = models.CharField(max_length=180)
	description = models.TextField()
	is_read = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	read_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		db_table = 'alerts'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['farmer', 'is_read', '-created_at']),
			models.Index(fields=['alert_type', 'severity']),
		]


class SensorStatus(models.Model):
	farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='sensor_statuses')
	device_id = models.CharField(max_length=64)
	status = models.CharField(max_length=24, default='online')
	firmware_version = models.CharField(max_length=64, blank=True)
	last_seen_at = models.DateTimeField(null=True, blank=True)
	error_message = models.CharField(max_length=255, blank=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'sensor_status'
		constraints = [
			models.UniqueConstraint(fields=['farmer', 'device_id'], name='unique_farmer_sensor_device'),
		]
		indexes = [
			models.Index(fields=['farmer', 'status']),
			models.Index(fields=['device_id', 'status']),
		]


class SystemLog(models.Model):
	ACTION_CHOICES = [('create', 'Create'), ('update', 'Update'), ('delete', 'Delete'), ('system', 'System')]

	farmer = models.ForeignKey(Farmer, null=True, blank=True, on_delete=models.SET_NULL, related_name='system_logs')
	action = models.CharField(max_length=10, choices=ACTION_CHOICES, default='system')
	entity = models.CharField(max_length=80)
	message = models.CharField(max_length=255)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'system_logs'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['farmer', '-created_at']),
			models.Index(fields=['entity', 'action', '-created_at']),
		]
