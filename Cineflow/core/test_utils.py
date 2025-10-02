from contextlib import contextmanager
from tempfile import TemporaryDirectory
from django.test import override_settings

@contextmanager
def temp_media():
    with TemporaryDirectory() as tmp:
        with override_settings(
            DEFAULT_FILE_STORAGE="django.core.files.storage.FileSystemStorage",
            MEDIA_ROOT=tmp,
        ):
            yield