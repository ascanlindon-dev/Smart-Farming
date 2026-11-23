
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


CONSENT_ROLE = 'rambutech_consent_api'


def enable_consent_rls(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    schema_editor.execute(f"""
        DO $consent_role$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_roles WHERE rolname = '{CONSENT_ROLE}'
            ) THEN
                CREATE ROLE {CONSENT_ROLE}
                    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
            ELSE
                ALTER ROLE {CONSENT_ROLE}
                    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
            END IF;
        END
        $consent_role$;
    """)

    schema_editor.execute(
        f'GRANT {CONSENT_ROLE} TO CURRENT_USER'
    )

    schema_editor.execute(
        f'GRANT USAGE ON SCHEMA public TO {CONSENT_ROLE}'
    )

    schema_editor.execute(f"""
        REVOKE ALL ON TABLE public.user_consents FROM PUBLIC;
        GRANT SELECT, INSERT ON TABLE public.user_consents TO {CONSENT_ROLE};
        GRANT UPDATE (withdrawn_at) ON TABLE public.user_consents TO {CONSENT_ROLE};
    """)

    # Escape PostgreSQL format placeholder for Psycopg.
    schema_editor.execute("""
        DO $consent_revoke$
        DECLARE
            role_name text;
        BEGIN
            FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
                IF EXISTS (
                    SELECT 1 FROM pg_roles WHERE rolname = role_name
                ) THEN
                    EXECUTE format(
                        'REVOKE ALL ON TABLE public.user_consents FROM %%I',
                        role_name
                    );
                END IF;
            END LOOP;
        END
        $consent_revoke$;
    """)

    schema_editor.execute(
        f'ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY'
    )

    schema_editor.execute(
        f'ALTER TABLE public.user_consents FORCE ROW LEVEL SECURITY'
    )

    schema_editor.execute(f"""
        CREATE POLICY user_consents_read_own_or_admin
        ON public.user_consents
        FOR SELECT TO {CONSENT_ROLE}
        USING (
            user_id = NULLIF(
                current_setting('app.rambutech_user_id', true), ''
            )::uuid
            OR current_setting('app.rambutech_is_admin', true) = 'true'
        );

        CREATE POLICY user_consents_insert_own
        ON public.user_consents
        FOR INSERT TO {CONSENT_ROLE}
        WITH CHECK (
            user_id = NULLIF(
                current_setting('app.rambutech_user_id', true), ''
            )::uuid
        );

        CREATE POLICY user_consents_withdraw_own
        ON public.user_consents
        FOR UPDATE TO {CONSENT_ROLE}
        USING (
            user_id = NULLIF(
                current_setting('app.rambutech_user_id', true), ''
            )::uuid
        )
        WITH CHECK (
            user_id = NULLIF(
                current_setting('app.rambutech_user_id', true), ''
            )::uuid
        );
    """)


def disable_consent_rls(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    schema_editor.execute("""
        DROP POLICY IF EXISTS user_consents_read_own_or_admin
        ON public.user_consents;

        DROP POLICY IF EXISTS user_consents_insert_own
        ON public.user_consents;

        DROP POLICY IF EXISTS user_consents_withdraw_own
        ON public.user_consents;

        ALTER TABLE public.user_consents
        NO FORCE ROW LEVEL SECURITY;

        ALTER TABLE public.user_consents
        DISABLE ROW LEVEL SECURITY;
    """)

    schema_editor.execute(
        f'REVOKE ALL ON TABLE public.user_consents FROM {CONSENT_ROLE}'
    )

    schema_editor.execute(
        f'REVOKE {CONSENT_ROLE} FROM CURRENT_USER'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_alert_diseasedetection_environmentalreading_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ConsentIdentity',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False
                    )
                ),
                (
                    'user',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='consent_identity',
                        to=settings.AUTH_USER_MODEL
                    )
                ),
            ],
            options={
                'db_table': 'consent_identities',
            },
        ),

        migrations.CreateModel(
            name='UserConsent',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False
                    )
                ),
                ('research_consent', models.BooleanField()),
                ('privacy_consent', models.BooleanField()),
                ('consent_version', models.TextField()),
                ('agreed_at', models.DateTimeField()),
                ('withdrawn_at', models.DateTimeField(blank=True, null=True)),
                (
                    'user',
                    models.ForeignKey(
                        db_column='user_id',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='consents',
                        to='api.consentidentity'
                    )
                ),
            ],
            options={
                'db_table': 'user_consents',
                'ordering': ['-agreed_at'],
            },
        ),

        migrations.AddIndex(
            model_name='userconsent',
            index=models.Index(
                fields=['user', '-agreed_at'],
                name='uc_user_agreed_idx'
            ),
        ),

        migrations.RunPython(
            enable_consent_rls,
            disable_consent_rls
        ),
    ]
