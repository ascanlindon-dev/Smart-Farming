# Generated for cached weather fallback support.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_prediction'),
    ]

    operations = [
        migrations.CreateModel(
            name='WeatherCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('requested_q', models.CharField(max_length=255)),
                ('normalized_q', models.CharField(db_index=True, max_length=255)),
                ('days', models.PositiveSmallIntegerField(default=7)),
                ('payload', models.JSONField()),
                ('fetched_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-fetched_at'],
                'indexes': [models.Index(fields=['normalized_q', '-fetched_at'], name='api_weather_norm_f6cfc5_idx')],
            },
        ),
    ]
