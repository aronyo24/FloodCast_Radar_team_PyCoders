import shutil
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings

from .factory import write_bundle


class BundleTestCase(TestCase):
    """Each test gets a private MEDIA_ROOT and a fresh sample bundle on disk."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="floodwatch-test-"))
        self.media = self.tmp / "media"
        override = override_settings(MEDIA_ROOT=self.media)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.bundle = write_bundle(self.tmp / "web_data")

    def import_bundle(self, path=None):
        from floods.importer import import_web_data

        return import_web_data(path or self.bundle, log_fn=lambda _msg: None)
