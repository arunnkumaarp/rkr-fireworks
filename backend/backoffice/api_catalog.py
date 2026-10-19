from decimal import Decimal

from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.utils.text import slugify
from rest_framework import generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminRole, IsStaffRole
from catalog.models import Category, Offer, Product, StockMovement
from orders.models import Coupon, EstimateItem

from . import audit
from .audit import AuditedMixin


class AdminProductSerializer(serializers.ModelSerializer):
    offer_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    effective_discount = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    stock_state = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = ["id", "code", "name", "category", "category_name", "mrp", "discount_percent", "effective_discount",
                  "offer_price", "unit", "description", "video_url", "is_active", "stock", "low_stock_threshold",
                  "stock_state", "updated_at"]
        # Stock changes only through the stock endpoint, so every change leaves a movement row.
        read_only_fields = ["stock", "updated_at"]

    def validate_mrp(self, value):
        if value <= 0:
            raise serializers.ValidationError("MRP must be above zero.")
        return value

    def validate_discount_percent(self, value):
        if not Decimal("0") <= value < Decimal("100"):
            raise serializers.ValidationError("Discount must be from 0 to 99.99%.")
        return value


class ProductAudit(AuditedMixin):
    audit_type = "product"

    def describe(self, p):
        return f"product {p.code}. {p.name}"


class AdminProductList(ProductAudit, generics.ListCreateAPIView):
    serializer_class = AdminProductSerializer
    permission_classes = [IsStaffRole]
    pagination_class = None
    search_fields = ["name", "=code"]
    filterset_fields = ["category", "is_active"]

    def get_queryset(self):
        qs = Product.objects.select_related("category")
        state = self.request.query_params.get("stock")
        if state == "out":
            qs = qs.filter(stock__lte=0)
        elif state == "low":
            qs = qs.filter(stock__gt=0, stock__lte=F("low_stock_threshold"))
        elif state == "tracked":
            qs = qs.filter(stock__isnull=False)
        elif state == "untracked":
            qs = qs.filter(stock__isnull=True)
        return qs


class AdminProductDetail(ProductAudit, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminProductSerializer
    permission_classes = [IsStaffRole]
    http_method_names = ["get", "patch", "delete"]
    queryset = Product.objects.select_related("category")

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if EstimateItem.objects.filter(product=product).exists():
            # Past estimates point at it; switching it off keeps that history intact.
            return Response({"detail": "This product is on past orders. Switch it off instead of deleting it."},
                            status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)


class StockChangeSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(["add", "remove", "set", "untrack"])
    quantity = serializers.IntegerField(min_value=0, max_value=1_000_000, required=False, default=0)
    reason = serializers.ChoiceField([StockMovement.Reason.RESTOCK, StockMovement.Reason.ADJUSTMENT,
                                      StockMovement.Reason.DAMAGE], required=False)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


@api_view(["POST"])
@permission_classes([IsStaffRole])
@transaction.atomic
def change_stock(request, pk):
    product = generics.get_object_or_404(Product.objects.select_for_update(), pk=pk)
    s = StockChangeSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    mode, qty, note = s.validated_data["mode"], s.validated_data["quantity"], s.validated_data["note"]
    old = product.stock

    if mode == "untrack":
        product.stock = None
        product.save(update_fields=["stock", "updated_at"])
        audit.record(request, "stock", "product", product.pk, f"Stopped tracking stock of {product.name}",
                     {"stock": [old, None]})
        return Response(AdminProductSerializer(product).data)

    current = old or 0
    if mode != "set" and qty == 0:
        return Response({"quantity": ["Enter a quantity."]}, status=status.HTTP_400_BAD_REQUEST)
    if mode == "set":
        new = qty
        default = StockMovement.Reason.TRACKING if old is None else StockMovement.Reason.ADJUSTMENT
    elif mode == "add":
        new, default = current + qty, StockMovement.Reason.RESTOCK
    else:
        if qty > current:
            return Response({"quantity": [f"Only {current} in stock."]}, status=status.HTTP_400_BAD_REQUEST)
        new, default = current - qty, StockMovement.Reason.DAMAGE
    reason = default if default == StockMovement.Reason.TRACKING else s.validated_data.get("reason", default)

    product.stock = new
    product.save(update_fields=["stock", "updated_at"])
    StockMovement.objects.create(product=product, change=new - current, balance=new, reason=reason, note=note,
                                 user=request.user)
    audit.record(request, "stock", "product", product.pk, f"Stock of {product.name}: {old} → {new}",
                 {"stock": [old, new], "reason": reason, "note": note})
    return Response(AdminProductSerializer(product).data)


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.IntegerField(source="product.code", read_only=True)
    estimate = serializers.CharField(source="estimate.number", read_only=True, default=None)
    user = serializers.CharField(source="user.email", read_only=True, default="")
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = StockMovement
        fields = ["id", "product", "product_code", "product_name", "change", "balance", "reason", "reason_label",
                  "estimate", "note", "user", "created_at"]


class StockMovementList(generics.ListAPIView):
    serializer_class = StockMovementSerializer
    permission_classes = [IsStaffRole]
    pagination_class = None
    filterset_fields = ["product", "reason"]

    queryset = StockMovement.objects.select_related("product", "estimate", "user")

    def filter_queryset(self, queryset):
        return super().filter_queryset(queryset)[:300]  # the latest 300 after filtering


@api_view(["GET"])
@permission_classes([IsStaffRole])
def inventory_summary(request):
    tracked = Product.objects.filter(stock__isnull=False)
    value = ExpressionWrapper(F("stock") * F("mrp"), output_field=DecimalField(max_digits=14, decimal_places=2))
    agg = Product.objects.aggregate(
        products=Count("id"),
        active=Count("id", filter=Q(is_active=True)),
        tracked=Count("id", filter=Q(stock__isnull=False)),
        out=Count("id", filter=Q(stock__lte=0)),
        low=Count("id", filter=Q(stock__gt=0, stock__lte=F("low_stock_threshold"))),
        units=Sum("stock", filter=Q(stock__gt=0)),
    )
    mrp_value = tracked.filter(stock__gt=0).aggregate(v=Sum(value))["v"] or Decimal("0")
    return Response({**agg, "units": agg["units"] or 0, "mrp_value": f"{mrp_value:.2f}"})


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    slug = serializers.SlugField(required=False)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "sort_order", "is_active", "product_count"]

    def validate(self, attrs):
        if "name" in attrs and not attrs.get("slug") and not (self.instance and self.instance.slug):
            attrs["slug"] = slugify(attrs["name"])[:110] or "category"
        return attrs


class CategoryAudit(AuditedMixin):
    audit_type = "category"

    def describe(self, c):
        return f"category {c.name}"

    def get_queryset(self):
        return Category.objects.annotate(product_count=Count("products")).order_by("sort_order", "name")


class CategoryList(CategoryAudit, generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsStaffRole]
    pagination_class = None


class CategoryDetail(CategoryAudit, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsStaffRole]
    http_method_names = ["get", "patch", "delete"]

    def destroy(self, request, *args, **kwargs):
        if self.get_object().products.exists():
            return Response({"detail": "Move or delete this category's products first, or switch it off."},
                            status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)


class OfferSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default="All products")
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = Offer
        fields = ["id", "name", "category", "category_name", "discount_percent", "starts_on", "ends_on", "is_active",
                  "is_running"]

    def validate(self, attrs):
        start = attrs.get("starts_on", getattr(self.instance, "starts_on", None))
        end = attrs.get("ends_on", getattr(self.instance, "ends_on", None))
        if start and end and end < start:
            raise serializers.ValidationError({"ends_on": "The offer must end on or after its start date."})
        pct = attrs.get("discount_percent")
        if pct is not None and not Decimal("0") < pct < Decimal("100"):
            raise serializers.ValidationError({"discount_percent": "Discount must be between 0 and 100%."})
        return attrs


class OfferAudit(AuditedMixin):
    audit_type = "offer"
    serializer_class = OfferSerializer
    permission_classes = [IsAdminRole]
    queryset = Offer.objects.select_related("category")

    def describe(self, o):
        return f"offer {o.name}"


class OfferList(OfferAudit, generics.ListCreateAPIView):
    pagination_class = None


class OfferDetail(OfferAudit, generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete"]


class CouponSerializer(serializers.ModelSerializer):
    times_used = serializers.IntegerField(read_only=True)

    class Meta:
        model = Coupon
        fields = ["id", "code", "description", "kind", "value", "min_order", "max_discount", "starts_on", "ends_on",
                  "usage_limit", "is_active", "times_used"]

    def validate_code(self, value):
        value = value.strip().upper()
        if not value.replace("-", "").isalnum():
            raise serializers.ValidationError("Use letters, numbers and dashes only.")
        clash = Coupon.objects.filter(code=value).exclude(pk=getattr(self.instance, "pk", None))
        if clash.exists():
            raise serializers.ValidationError("A coupon with this code already exists.")
        return value

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", Coupon.Kind.PERCENT))
        value = attrs.get("value", getattr(self.instance, "value", None))
        if value is not None and (value <= 0 or (kind == Coupon.Kind.PERCENT and value >= 100)):
            raise serializers.ValidationError({"value": "Percent coupons take 1–99; rupee coupons any amount above 0."})
        return attrs


class CouponAudit(AuditedMixin):
    audit_type = "coupon"
    serializer_class = CouponSerializer
    permission_classes = [IsAdminRole]
    queryset = Coupon.objects.all()

    def describe(self, c):
        return f"coupon {c.code}"

    def destroy(self, request, *args, **kwargs):
        if self.get_object().estimates.exists():
            return Response({"detail": "This coupon is on past orders. Switch it off instead."},
                            status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)


class CouponList(CouponAudit, generics.ListCreateAPIView):
    pagination_class = None


class CouponDetail(CouponAudit, generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete"]
