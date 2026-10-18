from django.db import transaction
from rest_framework import serializers

from catalog.models import Product
from content.models import ShopSettings

from .models import Estimate, EstimateItem


class EstimateItemSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = EstimateItem
        fields = ["code", "name", "unit", "mrp", "price", "quantity", "amount"]


class EstimateSerializer(serializers.ModelSerializer):
    items = EstimateItemSerializer(many=True, read_only=True)

    class Meta:
        model = Estimate
        fields = [
            "number", "customer_name", "phone", "email", "address", "city", "state",
            "pincode", "notes", "items", "mrp_total", "subtotal", "packing_charge",
            "total", "status", "transport_name", "lr_number", "created_at",
        ]
        read_only_fields = [
            "number", "mrp_total", "subtotal", "packing_charge", "total", "status",
            "transport_name", "lr_number", "created_at",
        ]


class CartLineSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=999)


class EstimateCreateSerializer(EstimateSerializer):
    lines = CartLineSerializer(many=True, write_only=True, allow_empty=False)

    class Meta(EstimateSerializer.Meta):
        fields = EstimateSerializer.Meta.fields + ["lines"]

    def validate_phone(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())[-10:]
        if len(digits) != 10:
            raise serializers.ValidationError("Enter a 10-digit mobile number.")
        return digits

    def validate_lines(self, lines):
        ids = [line["product"] for line in lines]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each product can appear only once.")
        products = Product.objects.filter(pk__in=ids, is_active=True).in_bulk()
        missing = set(ids) - set(products)
        if missing:
            raise serializers.ValidationError(f"Products no longer available: {sorted(missing)}")
        return [(products[line["product"]], line["quantity"]) for line in lines]

    def validate(self, attrs):
        shop = ShopSettings.load()
        subtotal = sum(p.offer_price * q for p, q in attrs["lines"])
        if subtotal < shop.min_order_value:
            raise serializers.ValidationError(
                {"lines": f"Minimum order value is ₹{shop.min_order_value:.0f}."})
        attrs["_shop"] = shop
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        shop = validated_data.pop("_shop")
        user = self.context["request"].user
        estimate = Estimate.objects.create(
            user=user if user.is_authenticated else None, **validated_data)
        EstimateItem.objects.bulk_create([
            EstimateItem(estimate=estimate, product=p, code=p.code, name=p.name, unit=p.unit,
                         mrp=p.mrp, price=p.offer_price, quantity=q)
            for p, q in lines
        ])
        estimate.recalculate(shop.packing_charge_percent)
        estimate.save()
        return estimate
