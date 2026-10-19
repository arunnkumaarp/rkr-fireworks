from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminRole, IsStaffRole
from content.models import ShopSettings
from orders.models import COMMITTED_STATUSES, Estimate, Payment, StockError, payment_status
from orders.serializers import EstimateItemSerializer, EstimateSerializer

from . import audit
from .queries import PAYMENT_FILTERS, STAGES, parse_date, with_paid


class AdminItemSerializer(EstimateItemSerializer):
    class Meta(EstimateItemSerializer.Meta):
        fields = ["id", "product"] + EstimateItemSerializer.Meta.fields


class PaymentSerializer(serializers.ModelSerializer):
    estimate = serializers.SlugRelatedField(slug_field="number", queryset=Estimate.objects.all())
    customer_name = serializers.CharField(source="estimate.customer_name", read_only=True)
    recorded_by = serializers.CharField(source="recorded_by.email", read_only=True, default="")

    class Meta:
        model = Payment
        fields = ["id", "estimate", "customer_name", "kind", "method", "amount", "paid_on", "reference", "note",
                  "recorded_by", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount above zero.")
        return value

    def validate(self, attrs):
        if attrs.get("kind") == Payment.Kind.REFUND and attrs["amount"] > attrs["estimate"].amount_paid:
            raise serializers.ValidationError(
                {"amount": f"Only ₹{attrs['estimate'].amount_paid} has been received on this order."})
        return attrs


class AdminEstimateSerializer(EstimateSerializer):
    """The shop's view of an estimate: customer's fields plus money, dispatch and internal notes."""

    items = AdminItemSerializer(many=True, read_only=True)
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    user = serializers.IntegerField(source="user_id", read_only=True)

    class Meta(EstimateSerializer.Meta):
        fields = EstimateSerializer.Meta.fields + ["admin_notes", "user", "amount_paid", "balance", "payment_status",
                                                   "updated_at"]
        read_only_fields = ["number", "email", "mrp_total", "subtotal", "packing_charge", "coupon_code", "discount",
                            "total", "created_at", "updated_at"]

    def _paid(self, e):
        return e.paid if hasattr(e, "paid") else e.amount_paid

    def get_amount_paid(self, e):
        return f"{self._paid(e):.2f}"

    def get_balance(self, e):
        if e.status == Estimate.Status.CANCELLED:
            return "0.00"
        return f"{max(e.total - self._paid(e), Decimal('0')):.2f}"

    def get_payment_status(self, e):
        return payment_status(e.total, self._paid(e), e.status)


class ItemChangeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=0, max_value=9999)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False)


AUDITED_FIELDS = ["status", "transport_name", "lr_number", "dispatch_date", "delivered_on", "customer_name", "phone",
                  "address", "city", "state", "pincode", "notes", "admin_notes", "total"]


class AdminEstimateUpdateSerializer(AdminEstimateSerializer):
    """Edits after the confirmation call: status, delivery, dispatch, notes and items (quantity 0 removes)."""

    item_changes = ItemChangeSerializer(many=True, write_only=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta(AdminEstimateSerializer.Meta):
        fields = AdminEstimateSerializer.Meta.fields + ["item_changes", "payments"]

    @transaction.atomic
    def update(self, instance, validated_data):
        before = audit.snapshot(instance, AUDITED_FIELDS)
        changes = validated_data.pop("item_changes", [])
        items = {i.id: i for i in instance.items.all()}
        item_log = []
        for change in changes:
            item = items.get(change["id"])
            if item is None:
                raise serializers.ValidationError({"item_changes": f"Item {change['id']} is not on this estimate."})
            item_log.append(f"{item.code}: {item.quantity}→{change['quantity']}")
            if change["quantity"] == 0:
                item.delete()
                continue
            item.quantity = change["quantity"]
            if "price" in change:
                item.price = change["price"]
            item.save(update_fields=["quantity", "price"])

        # Fill dispatch dates the moment the status says so, unless the admin typed one.
        today = timezone.localdate()
        new_status = validated_data.get("status", instance.status)
        if new_status in (Estimate.Status.DISPATCHED, Estimate.Status.DELIVERED) and not (
                validated_data.get("dispatch_date") or instance.dispatch_date):
            validated_data["dispatch_date"] = today
        if new_status == Estimate.Status.DELIVERED and not (validated_data.get("delivered_on") or instance.delivered_on):
            validated_data["delivered_on"] = today

        instance = super().update(instance, validated_data)
        if changes:
            instance.recalculate(ShopSettings.load().packing_charge_percent)
            instance.save()
        request = self.context["request"]
        try:
            instance.sync_stock(user=request.user)
        except StockError as e:
            raise serializers.ValidationError({"stock": str(e)})

        diff = audit.diff(before, instance)
        if item_log:
            diff["items"] = item_log
        if diff:
            verb = f"moved to {instance.get_status_display()}" if "status" in diff else "changed"
            audit.record(request, "update", "order", instance.number, f"Order {instance.number} {verb}", diff)
        return instance


class AdminEstimateList(generics.ListAPIView):
    serializer_class = AdminEstimateSerializer
    permission_classes = [IsStaffRole]
    filterset_fields = ["status"]
    search_fields = ["number", "customer_name", "phone", "email", "city", "lr_number"]

    def get_queryset(self):
        qs = with_paid(Estimate.objects.prefetch_related("items"))
        params = self.request.query_params
        if params.get("stage") in STAGES:
            qs = qs.filter(status__in=STAGES[params["stage"]])
        if params.get("payment") in PAYMENT_FILTERS:
            qs = qs.filter(PAYMENT_FILTERS[params["payment"]])
        if start := parse_date(params.get("from")):
            qs = qs.filter(created_at__date__gte=start)
        if end := parse_date(params.get("to")):
            qs = qs.filter(created_at__date__lte=end)
        if params.get("customer", "").isdigit():
            qs = qs.filter(user_id=params["customer"])
        return qs


class AdminEstimateDetail(generics.RetrieveUpdateAPIView):
    serializer_class = AdminEstimateUpdateSerializer
    permission_classes = [IsStaffRole]
    lookup_field = "number"
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return Estimate.objects.prefetch_related("items", "payments__recorded_by")


class PaymentList(generics.ListCreateAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["kind", "method"]
    search_fields = ["estimate__number", "estimate__customer_name", "reference"]

    def get_queryset(self):
        qs = Payment.objects.select_related("estimate", "recorded_by")
        params = self.request.query_params
        if start := parse_date(params.get("from")):
            qs = qs.filter(paid_on__gte=start)
        if end := parse_date(params.get("to")):
            qs = qs.filter(paid_on__lte=end)
        if params.get("estimate"):
            qs = qs.filter(estimate__number=params["estimate"])
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        p = serializer.save(recorded_by=self.request.user)
        e = p.estimate
        audit.record(self.request, "create", "payment", p.pk,
                     f"{p.get_kind_display()} of ₹{p.amount} ({p.get_method_display()}) on {e.number}",
                     {"amount": str(p.amount), "method": p.method, "kind": p.kind, "reference": p.reference})
        # A confirmed order that is now fully paid moves to "Payment received" on its own.
        if e.status == Estimate.Status.CONFIRMED and e.amount_paid >= e.total:
            e.status = Estimate.Status.PAID
            e.save(update_fields=["status", "updated_at"])
            audit.record(self.request, "update", "order", e.number, f"Order {e.number} moved to Paid",
                         {"status": ["confirmed", "paid"]})


class PaymentDetail(generics.RetrieveDestroyAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAdminRole]
    queryset = Payment.objects.select_related("estimate")

    def perform_destroy(self, p):
        audit.record(self.request, "delete", "payment", p.pk,
                     f"Removed {p.get_kind_display().lower()} of ₹{p.amount} on {p.estimate.number}",
                     {"amount": str(p.amount), "method": p.method, "paid_on": str(p.paid_on)})
        p.delete()


@api_view(["GET"])
@permission_classes([IsAdminRole])
def payments_summary(request):
    """Where the money stands across all confirmed orders, plus cancelled ones still holding money."""
    rows = with_paid(Estimate.objects.filter(Q(status__in=COMMITTED_STATUSES) | Q(status=Estimate.Status.CANCELLED)))
    buckets = {k: {"count": 0, "amount": Decimal("0")} for k in ("unpaid", "partial", "paid", "refund_due")}
    outstanding = Decimal("0")
    for e in rows.only("total", "status"):
        state = payment_status(e.total, e.paid, e.status)
        if state not in buckets:
            continue
        buckets[state]["count"] += 1
        if state == "refund_due":
            buckets[state]["amount"] += e.paid
        else:
            buckets[state]["amount"] += e.total
        if state in ("unpaid", "partial"):
            outstanding += e.total - e.paid
    sums = Payment.objects.values("kind").annotate(s=Sum("amount"), n=Count("id"))
    by_kind = {r["kind"]: r for r in sums}
    methods = (Payment.objects.filter(kind=Payment.Kind.PAYMENT).values("method")
               .annotate(amount=Sum("amount"), count=Count("id")).order_by("-amount"))
    return Response({
        "buckets": {k: {"count": v["count"], "amount": f"{v['amount']:.2f}"} for k, v in buckets.items()},
        "outstanding": f"{outstanding:.2f}",
        "received": f"{by_kind.get('payment', {}).get('s') or 0:.2f}",
        "refunded": f"{by_kind.get('refund', {}).get('s') or 0:.2f}",
        "by_method": [{"method": m["method"], "amount": f"{m['amount']:.2f}", "count": m["count"]} for m in methods],
    })

