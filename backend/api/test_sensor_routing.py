from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase

from api.db_router import SensorReadingRouter
from api.models import Prediction, SensorReading


class SensorRoutingTests(SimpleTestCase):
    def test_supabase_handles_sensor_reads_and_writes_only(self):
        router = SensorReadingRouter()
        with patch('api.db_router.settings', SimpleNamespace(DATABASES={'default': {}, 'sensors': {}})):
            self.assertEqual(router.db_for_read(SensorReading), 'sensors')
            self.assertEqual(router.db_for_write(SensorReading), 'sensors')
            for model in (User, Prediction):
                self.assertIsNone(router.db_for_read(model))
                self.assertIsNone(router.db_for_write(model))

    def test_local_and_isolated_test_databases_remain_supported(self):
        with patch('api.db_router.settings', SimpleNamespace(DATABASES={'default': {}})):
            router = SensorReadingRouter()
            self.assertIsNone(router.db_for_read(SensorReading))
            self.assertIsNone(router.db_for_write(SensorReading))
            self.assertIsNone(router.allow_migrate('default', 'api', 'sensorreading'))

    def test_sensor_database_migrations_cannot_move_accounts(self):
        with patch('api.db_router.settings', SimpleNamespace(DATABASES={'default': {}, 'sensors': {}})):
            router = SensorReadingRouter()
            self.assertTrue(router.allow_migrate('sensors', 'api', 'sensorreading'))
            self.assertFalse(router.allow_migrate('default', 'api', 'sensorreading'))
            self.assertFalse(router.allow_migrate('sensors', 'auth', 'user'))
            self.assertFalse(router.allow_migrate('sensors', 'api', 'prediction'))
            self.assertIsNone(router.allow_migrate('default', 'auth', 'user'))
