import re
from decimal import Decimal

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from catalog.models import Product

ADDRESS = {
    "customer_name": "Ravi", "phone": "+91 98765 43210", "address": "12 Main Road",
    "city": "Madurai", "state": "Tamil Nadu", "pincode": "625001",
}


@pytest.fixture
def client(db):
    call_command("import_products")
    return APIClient()


def line(code, qty):
    return {"product": Product.objects.get(code=code).pk, "quantity": qty}


def test_create_estimate_snapshots_prices_and_totals(client):
    # 2 x Miracle Pot (1760.00) + 3 x 2 3/4 Kuruvi (19.80)
    res = client.post("/api/v1/estimates/", {**ADDRESS, "lines": [line(34, 2), line(1, 3)]}, format="json")
    assert res.status_code == 201, res.json()
    data = res.json()
    assert re.fullmatch(r"RKR\d{2}-\d{4,}", data["number"])
    assert data["phone"] == "9876543210"
    assert Decimal(data["subtotal"]) == Decimal("3579.40")
    assert Decimal(data["mrp_total"]) == Decimal("17897.00")
    assert Decimal(data["total"]) == Decimal("3579.40")
    assert [i["code"] for i in data["items"]] == [1, 34]


def test_minimum_order_enforced(client):
    res = client.post("/api/v1/estimates/", {**ADDRESS, "lines": [line(1, 5)]}, format="json")
    assert res.status_code == 400
    assert "Minimum order" in str(res.json())


def test_lookup_requires_matching_phone(client):
    number = client.post("/api/v1/estimates/", {**ADDRESS, "lines": [line(34, 1)]}, format="json").json()["number"]
    assert client.get(f"/api/v1/estimates/{number}/", {"phone": "9876543210"}).status_code == 200
    assert client.get(f"/api/v1/estimates/{number}/", {"phone": "9000000000"}).status_code == 404
    assert client.get(f"/api/v1/estimates/{number}/").status_code == 404
