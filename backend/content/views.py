from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ShopSettings


class PublicSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = [
            "shop_name", "phone_primary", "phone_secondary", "whatsapp_number", "email",
            "address", "min_order_value", "packing_charge_percent", "announcement",
            "upi_id", "upi_qr", "bank_details",
        ]


@api_view(["GET"])
def public_settings(request):
    return Response(PublicSettingsSerializer(ShopSettings.load(), context={"request": request}).data)
