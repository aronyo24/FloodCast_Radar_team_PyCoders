from django.apps import AppConfig
from django.contrib.admin import apps as admin_apps


class FloodsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "floods"
    verbose_name = "FloodCast Radar"

    def ready(self):
        from . import scheduler

        scheduler.start()


class FloodWatchAdminConfig(admin_apps.AdminConfig):
    """Django admin, with FloodCast Radar's dashboard and data-import pages."""

    default = False  # FloodsConfig stays the default for "floods"
    default_site = "floods.admin_site.FloodWatchAdminSite"
