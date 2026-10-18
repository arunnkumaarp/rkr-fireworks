import re
from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import EmailOTP, User
from catalog.models import Product


def request_code(client, email="Ravi@Example.com"):
    res = client.post("/api/v1/auth/otp/send/", {"email": email}, format="json")
    assert res.status_code == 200, res.json()
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


@pytest.fixture
def client(db):
    return APIClient()


def test_login_with_emailed_code(client):
    code = request_code(client)
    assert mail.outbox[-1].to == ["ravi@example.com"]
    res = client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": code}, format="json")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "ravi@example.com" and body["user"]["role"] == "customer"

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert client.get("/api/v1/me/").json()["email"] == "ravi@example.com"
    # A code works only once.
    res = client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": code}, format="json")
    assert res.status_code == 400


def test_wrong_code_locks_after_max_attempts(client):
    code = request_code(client)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(EmailOTP.MAX_ATTEMPTS):
        assert client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": wrong}, format="json").status_code == 400
    assert client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": code}, format="json").status_code == 400


def test_expired_code_rejected_and_resend_throttled(client):
    code = request_code(client)
    assert client.post("/api/v1/auth/otp/send/", {"email": "ravi@example.com"}, format="json").status_code == 429
    EmailOTP.objects.update(created_at=EmailOTP.objects.get().created_at - timedelta(minutes=11))
    assert client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": code}, format="json").status_code == 400


def test_my_estimates_only_shows_own(client):
    call_command("import_products")
    tokens = client.post("/api/v1/auth/otp/verify/", {"email": "ravi@example.com", "code": request_code(client)}, format="json").json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    order = {
        "customer_name": "Ravi", "phone": "9876543210", "address": "12 Main Road", "city": "Madurai",
        "state": "Tamil Nadu", "pincode": "625001",
        "lines": [{"product": Product.objects.get(code=34).pk, "quantity": 1}],
    }
    assert client.post("/api/v1/estimates/", order, format="json").status_code == 201
    other = APIClient()
    other.force_authenticate(User.objects.create(username="b@x.com", email="b@x.com"))
    assert other.post("/api/v1/estimates/", order, format="json").status_code == 201

    mine = client.get("/api/v1/estimates/mine/").json()
    assert len(mine) == 1
    assert APIClient().get("/api/v1/estimates/mine/").status_code == 401
