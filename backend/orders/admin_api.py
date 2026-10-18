from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminRole
from catalog.models import Product
from content.models import ShopSettings

from .models import Estimate, EstimateItem
from .serializers import EstimateItemSerializer, EstimateSerializer

# Statuses where the shop has agreed the order, so it counts as revenue.
CONFIRMED = [Estimate.Status.CONFIRMED, Estimate.Status.PAID, Estimate.Status.PACKED,
             Estimate.Status.DISPATCHED, Estimate.Status.DELIVERED]


class AdminItemSerializer(EstimateItemSerializer):
    class Meta(EstimateItemSerializer.Meta):
        fields = ["id"] + EstimateItemSerializer.Meta.fields


class AdminEstimateSerializer(EstimateSerializer):
    items = AdminItemSerializer(many=True, read_only=True)

    class Meta(EstimateSerializer.Meta):
        read_only_fields = ["number", "email", "mrp_total", "subtotal", "packing_charge", "total", "created_at"]


class ItemChangeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=0, max_value=9999)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False)


class AdminEstimateUpdateSerializer(AdminEstimateSerializer):
    """Admin edits after the confirmation call: status, transport, and item quantities/prices (0 removes)."""

    item_changes = ItemChangeSerializer(many=True, write_only=True, required=False)

    class Meta(AdminEstimateSerializer.Meta):
        fields = AdminEstimateSerializer.Meta.fields + ["item_changes"]

    @transaction.atomic
    def update(self, instance, validated_data):
        changes = validated_data.pop("item_changes", [])
        items = {i.id: i for i in instance.items.all()}
        for change in changes:
            item = items.get(change["id"])
            if item is None:
                raise serializers.ValidationError({"item_changes": f"Item {change['id']} is not on this estimate."})
            if change["quantity"] == 0:
                item.delete()
                continue
            item.quantity = change["quantity"]
            if "price" in change:
                item.price = change["price"]
            item.save(update_fields=["quantity", "price"])
        instance = super().update(instance, validated_data)
        if changes:
            instance.recalculate(ShopSettings.load().packing_charge_percent)
            instance.save()
        return instance


class AdminEstimateList(generics.ListAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["status"]
    search_fields = ["number", "customer_name", "phone", "email", "city"]

    def get_queryset(self):
        return Estimate.objects.prefetch_related("items")


class AdminEstimateDetail(generics.RetrieveUpdateAPIView):
    serializer_class = AdminEstimateUpdateSerializer
    permission_classes = [IsAdminRole]
    lookup_field = "number"
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return Estimate.objects.prefetch_related("items")


@api_view(["GET"])
@permission_classes([IsAdminRole])
def dashboard(request):
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    agg = Estimate.objects.aggregate(
        today=Count("id", filter=Q(created_at__date=today)),
        this_week=Count("id", filter=Q(created_at__date__gte=week_start)),
        awaiting_call=Count("id", filter=Q(status=Estimate.Status.SUBMITTED)),
        to_dispatch=Count("id", filter=Q(status__in=[Estimate.Status.PAID, Estimate.Status.PACKED])),
        confirmed_value=Sum("total", filter=Q(status__in=CONFIRMED)),
    )
    top = (EstimateItem.objects.filter(estimate__status__in=CONFIRMED + [Estimate.Status.SUBMITTED])
           .values("code", "name").annotate(quantity=Sum("quantity")).order_by("-quantity")[:10])
    return Response({**agg, "confirmed_value": agg["confirmed_value"] or 0, "top_products": list(top)})


class AdminProductSerializer(serializers.ModelSerializer):
    offer_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = ["id", "code", "name", "category", "category_name", "mrp", "discount_percent",
                  "offer_price", "unit", "is_active"]
        read_only_fields = ["code", "category"]


class AdminProductList(generics.ListAPIView):
    serializer_class = AdminProductSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None
    search_fields = ["name", "=code"]
    queryset = Product.objects.select_related("category")


class AdminProductDetail(generics.RetrieveUpdateAPIView):
    serializer_class = AdminProductSerializer
    permission_classes = [IsAdminRole]
    http_method_names = ["get", "patch"]
    queryset = Product.objects.select_related("category")
