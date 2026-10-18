from decimal import Decimal

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from catalog.models import Category, Product


@pytest.fixture
def imported(db):
    call_command("import_products")


def test_import_loads_full_price_list(imported):
    assert Category.objects.count() == 23
    assert Product.objects.count() == 220
    # Running again updates in place rather than duplicating.
    call_command("import_products")
    assert Product.objects.count() == 220


@pytest.mark.parametrize("code,offer", [(1, "19.80"), (45, "304.92"), (54, "450.12"), (168, "12100.00")])
def test_offer_price_is_80_percent_off(imported, code, offer):
    assert Product.objects.get(code=code).offer_price == Decimal(offer)


def test_product_api_filters_and_hides_inactive(imported):
    Product.objects.filter(code=1).update(is_active=False)
    client = APIClient()
    data = client.get("/api/v1/products/", {"category__slug": "single-sound-crackers"}).json()
    assert [p["code"] for p in data] == list(range(2, 15))
    assert data[0]["offer_price"] == "28.60"


def test_search_by_code(imported):
    data = APIClient().get("/api/v1/products/", {"search": "163"}).json()
    assert [p["name"] for p in data] == ["Kohinoor Gift Box"]


def test_categories_follow_price_list_order(imported):
    names = [c["name"] for c in APIClient().get("/api/v1/categories/").json()]
    assert names[:3] == ["Single Sound Crackers", "Bijili Crackers", "Bombs"]
    assert names[-1] == "RKR Toys Special Crackers"
