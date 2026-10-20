"""Uploads (product/category images, UPI QR) in Vercel Blob, because Vercel's filesystem is thrown away."""
import mimetypes
import os

from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class VercelBlobStorage(Storage):
    def __init__(self):
        # Token looks like vercel_blob_rw_<storeId>_<secret>; public files live on <storeId>.public.blob.vercel-storage.com.
        store_id = os.environ["BLOB_READ_WRITE_TOKEN"].removeprefix("vercel_blob_rw_").partition("_")[0]
        self.base_url = f"https://{store_id.lower()}.public.blob.vercel-storage.com/"

    def _save(self, name, content):
        from vercel.blob.sync import put_blob

        content.seek(0)
        result = put_blob(
            name, content.read(), access="public", add_random_suffix=True,
            content_type=mimetypes.guess_type(name)[0], cache_control_max_age=60 * 60 * 24 * 365,
        )
        return result.pathname

    def get_available_name(self, name, max_length=None):
        return name  # Blob adds a random suffix, so names never collide.

    def exists(self, name):
        return False

    def delete(self, name):
        from vercel.blob.sync import delete_blob

        delete_blob(self.url(name))

    def url(self, name):
        return self.base_url + name

    def size(self, name):
        from vercel.blob.sync import head_blob

        return head_blob(self.url(name)).size
