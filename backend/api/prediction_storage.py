"""Save scan history locally and copy results to the configured cloud database.

Local and cloud auth_user IDs belong to different databases. Keep the cloud
user_id empty and record the original owner separately instead of linking a
scan to an unrelated cloud account. A stable source key makes retries safe.
"""
import logging
import uuid

from django.conf import settings
from django.db import connections, DatabaseError, transaction

from .models import Prediction

logger = logging.getLogger(__name__)


def prepare_prediction_sync():
    alias = settings.PREDICTION_SYNC_DATABASE
    if not alias or connections[alias].vendor != 'postgresql':
        raise ValueError('Configure a PostgreSQL PREDICTION_SYNC_DATABASE first.')
    with transaction.atomic(using=alias), connections[alias].cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '5s'")
        cursor.execute('ALTER TABLE public.api_prediction ADD COLUMN IF NOT EXISTS source_key uuid NULL')
        cursor.execute('ALTER TABLE public.api_prediction ADD COLUMN IF NOT EXISTS source_user_id integer NULL')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS api_prediction_source_key_unique ON public.api_prediction (source_key)')


def sync_prediction(prediction):
    alias = settings.PREDICTION_SYNC_DATABASE
    if not alias:
        return None
    if alias == prediction._state.db:
        return prediction.pk
    namespace = uuid.UUID(settings.PREDICTION_SYNC_NAMESPACE)
    source_key = str(uuid.uuid5(namespace, str(prediction.pk)))
    with connections[alias].cursor() as cursor:
        cursor.execute('''
            INSERT INTO api_prediction (
                prediction_type, label, confidence, image_name, raw_probs,
                created_at, user_id, source_key, source_user_id
            ) VALUES (%s, %s, %s, %s, %s, %s, NULL, %s, %s)
            ON CONFLICT (source_key) DO UPDATE SET
                prediction_type = EXCLUDED.prediction_type,
                label = EXCLUDED.label,
                confidence = EXCLUDED.confidence,
                image_name = EXCLUDED.image_name,
                raw_probs = EXCLUDED.raw_probs,
                created_at = EXCLUDED.created_at,
                source_user_id = EXCLUDED.source_user_id
            RETURNING id
        ''', [
            prediction.prediction_type, prediction.label, prediction.confidence,
            prediction.image_name, prediction.raw_probs, prediction.created_at,
            source_key, prediction.user_id,
        ])
        return cursor.fetchone()[0]


def prediction_storage_status(prediction):
    result = {'saved': True, 'prediction_id': prediction.pk, 'cloud_saved': None}
    try:
        cloud_id = sync_prediction(prediction)
        if cloud_id is not None:
            result.update(cloud_saved=True, cloud_prediction_id=cloud_id)
    except (DatabaseError, ValueError, KeyError):
        logger.exception('Cloud sync failed for saved prediction %s', prediction.pk)
        result.update(cloud_saved=False, error_code='prediction_cloud_sync_failed')
    return result


def save_prediction(**values):
    try:
        prediction = Prediction.objects.create(**values)
    except DatabaseError:
        logger.exception('Could not save %s scan history', values.get('prediction_type'))
        return {'saved': False, 'cloud_saved': False, 'error_code': 'prediction_save_failed'}
    return prediction_storage_status(prediction)
