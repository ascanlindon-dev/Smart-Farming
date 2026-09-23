from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.models import Prediction
from api.prediction_storage import prepare_prediction_sync, sync_prediction


class Command(BaseCommand):
    help = 'Copy saved scan results to cloud storage without deleting history or changing owners.'

    def add_arguments(self, parser):
        parser.add_argument('--prepare', action='store_true', help='Add cloud source/owner columns and the retry-safe unique index.')
        parser.add_argument('--ids', type=int, nargs='+', help='Sync only these local prediction IDs.')

    def handle(self, *args, **options):
        if not settings.PREDICTION_SYNC_DATABASE:
            raise CommandError('Set PREDICTION_SYNC_DATABASE and PREDICTION_SYNC_NAMESPACE first.')
        if options['prepare']:
            prepare_prediction_sync()
        predictions = Prediction.objects.order_by('pk')
        if options['ids']:
            predictions = predictions.filter(pk__in=options['ids'])
        count = 0
        # Finish the local read before cloud calls, so SQLite is not kept locked
        # while another user is saving a new scan.
        for prediction in list(predictions):
            try:
                sync_prediction(prediction)
            except Exception as exc:
                raise CommandError(f'Cloud sync failed at local prediction {prediction.pk}; local history is intact.') from exc
            count += 1
            if count % 25 == 0:
                self.stdout.write(f'Synced {count} scan results...')
        self.stdout.write(self.style.SUCCESS(f'Synced {count} scan results. Original owners and scan times preserved.'))
