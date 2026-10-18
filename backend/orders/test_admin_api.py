from decimal import Decimal

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Product

ADDRESS = {"customer_name": "Ravi", "phone": "9876543210", "address": "12 Main Road",
           "city": "Madurai", "state": "Tamil Nadu", "pincode": "625001"}


@pytest.fixture
def setup(db):
    call_command("import_products")
    customer = APIClient()
    customer.force_authenticate(User.objects.create(username="c@x.com", email="c@x.com"))
    admin = APIClient()
    admin.force_authenticate(User.objects.create(username="a@x.com", email="a@x.com", role=User.Role.ADMIN))
    lines = [{"product": Product.objects.get(code=c).pk, "quantity": q} for c, q in [(34, 2), (1, 3)]]
    number = customer.post("/api/v1/estimates/", {**ADDRESS, "lines": lines}, format="json").json()["number"]
    return customer, admin, number


def test_customers_cannot_use_admin_api(setup):
    customer, _, number = setup
    for url in ["/api/v1/admin/dashboard/", "/api/v1/admin/estimates/", f"/api/v1/admin/estimates/{number}/",
                "/api/v1/admin/products/"]:
        assert customer.get(url).status_code == 403
        assert APIClient().get(url).status_code == 401


def test_admin_edits_items_status_and_transport(setup):
    _, admin, number = setup
    items = {i["code"]: i for i in admin.get(f"/api/v1/admin/estimates/{number}/").json()["items"]}
    res = admin.patch(f"/api/v1/admin/estimates/{number}/", {
        "status": "dispatched", "transport_name": "KPN", "lr_number": "LR123",
        "item_changes": [{"id": items[34]["id"], "quantity": 1, "price": "1700.00"},
                         {"id": items[1]["id"], "quantity": 0}],
    }, format="json")
    assert res.status_code == 200, res.json()
    data = res.json()
    assert (data["status"], data["lr_number"]) == ("dispatched", "LR123")
    assert [(i["code"], i["quantity"]) for i in data["items"]] == [(34, 1)]
    assert Decimal(data["total"]) == Decimal("1700.00")


def test_dashboard_and_filters(setup):
    _, admin, number = setup
    d = admin.get("/api/v1/admin/dashboard/").json()
    assert (d["today"], d["awaiting_call"], Decimal(str(d["confirmed_value"]))) == (1, 1, 0)
    admin.patch(f"/api/v1/admin/estimates/{number}/", {"status": "confirmed"}, format="json")
    d = admin.get("/api/v1/admin/dashboard/").json()
    assert Decimal(str(d["confirmed_value"])) == Decimal("3579.40")
    assert d["top_products"][0]["code"] == 1  # 3 x Kuruvi beats 2 x Miracle Pot
    assert admin.get("/api/v1/admin/estimates/", {"status": "submitted"}).json() == []
    assert [e["number"] for e in admin.get("/api/v1/admin/estimates/", {"search": "Ravi"}).json()] == [number]


def test_admin_product_price_and_toggle(setup):
    _, admin, _ = setup
    pid = Product.objects.get(code=1).pk
    res = admin.patch(f"/api/v1/admin/products/{pid}/", {"mrp": "110.00", "is_active": False}, format="json")
    assert res.json()["offer_price"] == "22.00"
    assert all(p["code"] != 1 for p in APIClient().get("/api/v1/products/").json())
