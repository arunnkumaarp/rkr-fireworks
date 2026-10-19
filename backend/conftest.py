import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    # Running offers are cached; a test must never see another test's offers.
    cache.clear()
    yield
    cache.clear()
