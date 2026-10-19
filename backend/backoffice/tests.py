from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from backoffice.models import AuditLog
from catalog.models import Category, Product, StockMovement
from orders.models import Estimate

ADDRESS = {"customer_name": "Ravi", "phone": "9876543210", "address": "12 Main Road",
           "city": "Madurai", "state": "Tamil Nadu", "pincode": "625001"}
A = "/api/v1/admin"


def client_for(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user)
    return c


@pytest.fixture
def shop(db):
    call_command("import_products")
    customer = User.objects.create(username="c@x.com", email="c@x.com")
    return {
        "customer": client_for(customer),
        "customer_user": customer,
        "admin": client_for(User.objects.create(username="a@x.com", email="a@x.com", role=User.Role.ADMIN)),
        "staff": client_for(User.objects.create(username="s@x.com", email="s@x.com", role=User.Role.STAFF)),
    }


def order(shop, lines=((34, 2), (1, 3)), **extra):
    body = {**ADDRESS, "lines": [{"product": Product.objects.get(code=c).pk, "quantity": q} for c, q in lines], **extra}
    res = shop["customer"].post("/api/v1/estimates/", body, format="json")
    assert res.status_code == 201, res.json()
    return res.json()


STAFF_URLS = ["/dashboard/", "/notifications/", "/estimates/", "/products/", "/categories/", "/inventory/",
              "/stock-movements/", "/customers/"]
ADMIN_URLS = ["/payments/", "/payments/summary/", "/expenses/", "/reports/", "/offers/", "/coupons/", "/settings/",
              "/team/", "/audit/"]


def test_every_admin_endpoint_is_protected(shop):
    for url in STAFF_URLS + ADMIN_URLS:
        assert client_for().get(A + url).status_code == 401, url
        assert shop["customer"].get(A + url).status_code == 403, url
        assert shop["admin"].get(A + url).status_code == 200, url
    for url in STAFF_URLS:
        assert shop["staff"].get(A + url).status_code == 200, url
    for url in ADMIN_URLS:
        assert shop["staff"].get(A + url).status_code == 403, url
    # Writes are protected too.
    assert shop["customer"].post(A + "/products/", {}, format="json").status_code == 403
    assert shop["staff"].post(A + "/expenses/", {}, format="json").status_code == 403


def test_staff_dashboard_hides_money(shop):
    order(shop)
    assert "money" not in shop["staff"].get(A + "/dashboard/").json()
    d = shop["admin"].get(A + "/dashboard/").json()
    assert d["awaiting_call"] == 1 and len(d["series"]) == 30 and d["recent"][0]["customer_name"] == "Ravi"
    assert d["money"]["received_total"] == "0.00"


def test_product_create_edit_delete_and_audit(shop):
    admin = shop["admin"]
    cat = admin.post(A + "/categories/", {"name": "Festival Hampers", "sort_order": 99}, format="json").json()
    assert cat["slug"] == "festival-hampers"
    res = admin.post(A + "/products/", {"code": 9001, "name": "Family Pack", "category": cat["id"], "mrp": "2000.00",
                                        "discount_percent": "75", "unit": "Box"}, format="json")
    assert res.status_code == 201, res.json()
    pid = res.json()["id"]
    assert res.json()["offer_price"] == "500.00"
    # New products show on the customer list straight away.
    assert any(p["code"] == 9001 for p in client_for().get("/api/v1/products/").json())
    assert admin.patch(f"{A}/products/{pid}/", {"name": "Family Pack XL"}, format="json").status_code == 200
    # Duplicate code is refused.
    dup = admin.post(A + "/products/", {"code": 9001, "name": "x", "category": cat["id"], "mrp": "1"}, format="json")
    assert dup.status_code == 400
    # A category with products can't be deleted; the product can, as it was never ordered.
    assert admin.delete(f"{A}/categories/{cat['id']}/").status_code == 409
    assert admin.delete(f"{A}/products/{pid}/").status_code == 204
    actions = list(AuditLog.objects.filter(object_type="product").values_list("action", flat=True))
    assert sorted(actions) == ["create", "delete", "update"]


def test_ordered_products_cannot_be_deleted(shop):
    order(shop)
    pid = Product.objects.get(code=34).pk
    assert shop["admin"].delete(f"{A}/products/{pid}/").status_code == 409
    assert Product.objects.filter(pk=pid).exists()


def test_stock_follows_order_status(shop):
    admin = shop["admin"]
    pid = Product.objects.get(code=34).pk
    assert admin.post(f"{A}/products/{pid}/stock/", {"mode": "set", "quantity": 5}, format="json").json()["stock"] == 5
    number = order(shop)["number"]
    assert Product.objects.get(pk=pid).stock == 5  # a new estimate holds nothing yet

    assert admin.patch(f"{A}/estimates/{number}/", {"status": "confirmed"}, format="json").status_code == 200
    assert Product.objects.get(pk=pid).stock == 3
    # Editing quantities on a confirmed order moves stock by the difference.
    items = {i["code"]: i for i in admin.get(f"{A}/estimates/{number}/").json()["items"]}
    admin.patch(f"{A}/estimates/{number}/", {"item_changes": [{"id": items[34]["id"], "quantity": 4}]}, format="json")
    assert Product.objects.get(pk=pid).stock == 1
    # Asking for more than is left is refused and nothing changes.
    res = admin.patch(f"{A}/estimates/{number}/", {"item_changes": [{"id": items[34]["id"], "quantity": 9}]},
                      format="json")
    assert res.status_code == 400 and "stock" in res.json()
    assert Product.objects.get(pk=pid).stock == 1
    # Cancelling gives it all back.
    admin.patch(f"{A}/estimates/{number}/", {"status": "cancelled"}, format="json")
    assert Product.objects.get(pk=pid).stock == 5
    assert StockMovement.objects.filter(product_id=pid).count() == 4


def test_out_of_stock_hidden_and_checkout_limited(shop):
    admin = shop["admin"]
    p34, p1 = Product.objects.get(code=34), Product.objects.get(code=1)
    admin.post(f"{A}/products/{p34.pk}/stock/", {"mode": "set", "quantity": 1}, format="json")
    body = {**ADDRESS, "lines": [{"product": p34.pk, "quantity": 2}]}
    res = shop["customer"].post("/api/v1/estimates/", body, format="json")
    assert res.status_code == 400 and "Only 1" in str(res.json())
    admin.post(f"{A}/products/{p1.pk}/stock/", {"mode": "set", "quantity": 0}, format="json")
    codes = {p["code"] for p in client_for().get("/api/v1/products/").json()}
    assert 1 not in codes and 34 in codes
    low = admin.get(A + "/products/", {"stock": "low"}).json()
    assert [p["code"] for p in low] == [34]
    inv = admin.get(A + "/inventory/").json()
    assert (inv["out"], inv["low"], inv["tracked"]) == (1, 1, 2)
    # Removing more than is there is refused.
    assert admin.post(f"{A}/products/{p34.pk}/stock/", {"mode": "remove", "quantity": 3},
                      format="json").status_code == 400


def test_payments_status_and_refunds(shop):
    admin = shop["admin"]
    e = order(shop)  # 3579.40
    number = e["number"]
    admin.patch(f"{A}/estimates/{number}/", {"status": "confirmed"}, format="json")
    pay = {"estimate": number, "amount": "1000.00", "method": "upi", "reference": "UPI123"}
    assert admin.post(A + "/payments/", pay, format="json").status_code == 201
    d = admin.get(f"{A}/estimates/{number}/").json()
    assert (d["payment_status"], d["balance"], d["status"]) == ("partial", "2579.40", "confirmed")
    assert [x["number"] for x in admin.get(A + "/estimates/", {"payment": "partial"}).json()] == [number]
    admin.post(A + "/payments/", {**pay, "amount": "2579.40", "method": "cash"}, format="json")
    d = admin.get(f"{A}/estimates/{number}/").json()
    assert (d["payment_status"], d["status"]) == ("paid", "paid")  # fully paid moves the order on

    refund = admin.post(A + "/payments/", {**pay, "kind": "refund", "amount": "5000"}, format="json")
    assert refund.status_code == 400
    admin.patch(f"{A}/estimates/{number}/", {"status": "cancelled"}, format="json")
    assert admin.get(A + "/payments/summary/").json()["buckets"]["refund_due"]["count"] == 1
    admin.post(A + "/payments/", {**pay, "kind": "refund", "amount": "3579.40"}, format="json")
    s = admin.get(A + "/payments/summary/").json()
    assert (s["received"], s["refunded"], s["buckets"]["refund_due"]["count"]) == ("3579.40", "3579.40", 0)


def test_coupon_applies_at_checkout(shop):
    admin = shop["admin"]
    res = admin.post(A + "/coupons/", {"code": "diwali10", "kind": "percent", "value": "10", "min_order": "1000",
                                       "max_discount": "300"}, format="json")
    assert res.status_code == 201 and res.json()["code"] == "DIWALI10"
    check = shop["customer"].post("/api/v1/coupons/check/", {"code": "Diwali10", "subtotal": "3579.40"},
                                  format="json")
    assert check.json()["discount"] == "300.00"  # capped
    e = order(shop, coupon="diwali10")
    assert (e["coupon_code"], e["discount"], e["total"]) == ("DIWALI10", "300.00", "3279.40")
    bad = shop["customer"].post("/api/v1/estimates/", {**ADDRESS, "coupon": "NOPE", "lines": [
        {"product": Product.objects.get(code=34).pk, "quantity": 2}]}, format="json")
    assert bad.status_code == 400 and "coupon" in bad.json()
    # Expired coupons are refused.
    admin.patch(f"{A}/coupons/{res.json()['id']}/", {"ends_on": str(timezone.localdate() - timedelta(days=1))},
                format="json")
    assert shop["customer"].post("/api/v1/coupons/check/", {"code": "DIWALI10", "subtotal": "5000"},
                                 format="json").status_code == 400


def test_running_offer_changes_public_price(shop):
    admin = shop["admin"]
    p = Product.objects.get(code=1)
    today = timezone.localdate()
    res = admin.post(A + "/offers/", {"name": "Diwali week", "category": p.category_id, "discount_percent": "85",
                                      "starts_on": str(today), "ends_on": str(today + timedelta(days=7))},
                     format="json")
    assert res.status_code == 201 and res.json()["is_running"]
    public = {x["code"]: x for x in client_for().get("/api/v1/products/").json()}
    assert public[1]["discount_percent"] == "85.00"
    assert Decimal(public[1]["offer_price"]) == (p.mrp * Decimal("0.15")).quantize(Decimal("0.01"))
    admin.patch(f"{A}/offers/{res.json()['id']}/", {"is_active": False}, format="json")
    assert {x["code"]: x for x in client_for().get("/api/v1/products/").json()}[1]["discount_percent"] == "80.00"
    bad = admin.post(A + "/offers/", {"name": "x", "discount_percent": "10", "starts_on": str(today),
                                      "ends_on": str(today - timedelta(days=1))}, format="json")
    assert bad.status_code == 400


def test_reports_and_csv(shop):
    admin = shop["admin"]
    number = order(shop)["number"]
    admin.patch(f"{A}/estimates/{number}/", {"status": "confirmed"}, format="json")
    admin.post(A + "/payments/", {"estimate": number, "amount": "3000", "method": "upi"}, format="json")
    assert admin.post(A + "/expenses/", {"category": "transport", "amount": "500", "description": "Lorry"},
                      format="json").status_code == 201
    future = str(timezone.localdate() + timedelta(days=2))
    assert admin.post(A + "/expenses/", {"amount": "5", "spent_on": future}, format="json").status_code == 400
    r = admin.get(A + "/reports/").json()
    assert r["totals"] == {"orders": 1, "sales": "3579.40", "received": "3000.00", "expenses": "500.00",
                           "profit": "2500.00", "cancelled": 0}
    assert r["group"] == "day" and r["expenses_by_category"][0]["label"] == "Transport"
    y = admin.get(A + "/reports/", {"from": "2020-01-01", "group": "year"}).json()
    assert [row["period"][:4] for row in y["rows"]][0] == "2020" and y["totals"]["profit"] == "2500.00"
    csv = admin.get(A + "/reports/", {"download": "summary"})
    assert csv["Content-Type"].startswith("text/csv") and b"2500.00" in csv.content
    orders_csv = admin.get(A + "/reports/", {"download": "orders"}).content.decode("utf-8-sig")
    assert number in orders_csv and "579.40" in orders_csv  # balance


def test_customers_totals_not_inflated_by_search(shop):
    admin = shop["admin"]
    for _ in range(2):
        n = order(shop)["number"]
        admin.patch(f"{A}/estimates/{n}/", {"status": "confirmed"}, format="json")
    for params in ({}, {"search": "Madurai"}, {"show": "repeat"}):
        rows = admin.get(A + "/customers/", params).json()
        assert len(rows) == 1, params
        assert (rows[0]["orders"], rows[0]["purchases"]) == (2, "7158.80"), params
    detail = admin.get(f"{A}/customers/{shop['customer_user'].pk}/").json()
    assert detail["city"] == "Madurai" and "625001" in detail["address"]
    # Admin and staff accounts are not listed as customers.
    assert all(c["email"] == "c@x.com" for c in admin.get(A + "/customers/").json())


def test_dispatch_dates_fill_themselves(shop):
    admin = shop["admin"]
    number = order(shop)["number"]
    d = admin.patch(f"{A}/estimates/{number}/", {"status": "dispatched", "transport_name": "KPN",
                                                 "lr_number": "LR9"}, format="json").json()
    assert d["dispatch_date"] == str(timezone.localdate())
    d = admin.patch(f"{A}/estimates/{number}/", {"status": "delivered"}, format="json").json()
    assert d["delivered_on"] == str(timezone.localdate())
    assert [e["number"] for e in admin.get(A + "/estimates/", {"stage": "completed"}).json()] == [number]
    # The customer sees dispatch details but not the shop's notes.
    admin.patch(f"{A}/estimates/{number}/", {"admin_notes": "regular buyer"}, format="json")
    mine = shop["customer"].get(f"/api/v1/estimates/{number}/").json()
    assert mine["lr_number"] == "LR9" and "admin_notes" not in mine


def test_team_roles_and_guards(shop):
    admin = shop["admin"]
    res = admin.post(A + "/team/", {"email": "New@Shop.com", "role": "staff"}, format="json")
    assert res.status_code == 201 and res.json()["role"] == "staff"
    uid = res.json()["id"]
    assert admin.patch(f"{A}/team/{uid}/", {"role": "admin"}, format="json").json()["role"] == "admin"
    me = admin.get(A + "/team/").json()
    my_id = next(m["id"] for m in me if m["email"] == "a@x.com")
    assert admin.delete(f"{A}/team/{my_id}/").status_code == 400  # can't remove yourself
    assert admin.delete(f"{A}/team/{uid}/").status_code == 200
    assert User.objects.get(pk=uid).role == "customer"
    assert AuditLog.objects.filter(action="team").count() == 3


def test_settings_update_is_audited(shop):
    admin = shop["admin"]
    res = admin.patch(A + "/settings/", {"upi_id": "rkr@upi", "packing_charge_percent": "3"}, format="json")
    assert res.json()["upi_id"] == "rkr@upi"
    assert admin.patch(A + "/settings/", {"packing_charge_percent": "80"}, format="json").status_code == 400
    log = AuditLog.objects.get(object_type="settings")
    assert log.changes["upi_id"] == ["", "rkr@upi"]
    assert client_for().get("/api/v1/settings/public/").json()["upi_id"] == "rkr@upi"


def test_notifications_and_seen(shop):
    admin = shop["admin"]
    order(shop)
    Product.objects.filter(code=1).update(stock=0)
    n = admin.get(A + "/notifications/").json()
    kinds = {i["kind"] for i in n["items"]}
    assert {"new_order", "stock"} <= kinds and n["unread"] == len(n["items"])
    admin.post(A + "/notifications/seen/")
    assert admin.get(A + "/notifications/").json()["unread"] == 0


def test_order_filters(shop):
    admin = shop["admin"]
    a, b = order(shop)["number"], order(shop)["number"]
    admin.patch(f"{A}/estimates/{b}/", {"status": "packed"}, format="json")
    assert [e["number"] for e in admin.get(A + "/estimates/", {"stage": "new"}).json()] == [a]
    assert [e["number"] for e in admin.get(A + "/estimates/", {"stage": "processing"}).json()] == [b]
    assert len(admin.get(A + "/estimates/", {"stage": "open"}).json()) == 2
    Estimate.objects.filter(number=a).update(created_at=timezone.now() - timedelta(days=40))
    since = str(timezone.localdate() - timedelta(days=5))
    assert [e["number"] for e in admin.get(A + "/estimates/", {"from": since}).json()] == [b]
