from rest_framework.test import APIClient


def test_public_settings_has_shop_contacts(db):
    data = APIClient().get("/api/v1/settings/public/").json()
    assert data["shop_name"] == "RKR Crackers"
    assert data["phone_primary"] == "9500403856"
