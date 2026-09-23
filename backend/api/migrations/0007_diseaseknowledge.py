# Generated manually for RAMBUTECH disease recommendation knowledge records.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0006_emailotp_and_more')]

    operations = [
        migrations.CreateModel(
            name='DiseaseKnowledge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('disease', models.CharField(max_length=100, unique=True)),
                ('scientific_name', models.CharField(blank=True, max_length=160)),
                ('symptoms', models.JSONField(blank=True, default=list)),
                ('risk_factors', models.JSONField(blank=True, default=list)),
                ('prevention', models.JSONField(blank=True, default=list)),
                ('immediate_actions', models.JSONField(blank=True, default=list)),
                ('cultural_control', models.JSONField(blank=True, default=list)),
                ('treatment', models.JSONField(blank=True, default=dict)),
                ('chemical_treatment', models.JSONField(blank=True, default=dict)),
                ('safety', models.JSONField(blank=True, default=list)),
                ('when_to_seek_help', models.TextField(blank=True)),
                ('sources', models.JSONField(blank=True, default=list)),
                ('verification_status', models.CharField(default='curated_nonchemical', max_length=40)),
                ('last_verified', models.DateField(blank=True, null=True)),
            ],
        ),
    ]
