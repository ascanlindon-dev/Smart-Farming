from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_consent_records'),
    ]

    operations = [
        migrations.AddField(
            model_name='sensorreading',
            name='is_raining',
            field=models.BooleanField(blank=True, null=True),
        ),
    ]
