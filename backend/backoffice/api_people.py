from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, Max, Prefetch, Q, Sum
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsAdminRole, IsStaffRole
from content.models import ShopSettings
from orders.models import COMMITTED_STATUSES, Estimate, Payment

from . import audit
from .models import AuditLog
from .queries import signed_amount


class CustomerSerializer(serializers.ModelSerializer):
    orders = serializers.IntegerField(read_only=True)
    open_orders = serializers.IntegerField(read_only=True)
    purchases = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    last_order = serializers.DateTimeField(read_only=True)
    city = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "phone", "date_joined", "last_login", "is_active", "orders",
                  "open_orders", "purchases", "last_order", "city"]

    def get_city(self, user):
        latest = next(iter(user.estimates.all()), None)  # prefetched newest first
        return latest.city if latest else ""


def customers_queryset():
    return (User.objects.filter(role=User.Role.CUSTOMER, is_superuser=False)
            .annotate(orders=Count("estimates", distinct=True),
                      open_orders=Count("estimates", distinct=True,
                                        filter=~Q(estimates__status__in=["delivered", "cancelled"])),
                      purchases=Sum("estimates__total", filter=Q(estimates__status__in=COMMITTED_STATUSES)),
                      last_order=Max("estimates__created_at"))
            .prefetch_related(Prefetch("estimates", queryset=Estimate.objects.order_by("-created_at"))))


class CustomerList(generics.ListAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        qs = customers_queryset()
        if q := self.request.query_params.get("search", "").strip():
            # Matched through a subquery: joining estimates here would inflate the totals.
            via_orders = Estimate.objects.filter(
                Q(customer_name__icontains=q) | Q(city__icontains=q) | Q(phone__icontains=q)).values("user_id")
            qs = qs.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(phone__icontains=q)
                           | Q(id__in=via_orders))
        show = self.request.query_params.get("show")
        if show == "new":
            qs = qs.filter(date_joined__gte=timezone.now() - timedelta(days=30))
        elif show == "buyers":
            qs = qs.filter(orders__gt=0)
        elif show == "repeat":
            qs = qs.filter(orders__gt=1)
        order = {"purchases": "-purchases", "recent": "-last_order", "joined": "-date_joined"}.get(
            self.request.query_params.get("sort"), "-date_joined")
        return qs.order_by(F(order[1:]).desc(nulls_last=True), "-id")


class CustomerDetail(generics.RetrieveAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        return customers_queryset()

    def retrieve(self, request, *args, **kwargs):
        data = self.get_serializer(self.get_object()).data
        paid = Payment.objects.filter(estimate__user_id=data["id"]).aggregate(s=Sum(signed_amount()))["s"]
        latest = Estimate.objects.filter(user_id=data["id"]).order_by("-created_at").first()
        data["amount_paid"] = f"{paid or Decimal('0'):.2f}"
        data["address"] = (f"{latest.address}, {latest.city}, {latest.state} – {latest.pincode}" if latest else "")
        return Response(data)


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = ["shop_name", "phone_primary", "phone_secondary", "whatsapp_number", "email", "address",
                  "min_order_value", "packing_charge_percent", "upi_id", "upi_qr", "bank_details", "announcement"]
        read_only_fields = ["upi_qr"]

    def validate_packing_charge_percent(self, value):
        if not Decimal("0") <= value <= Decimal("50"):
            raise serializers.ValidationError("Packing charge must be from 0 to 50%.")
        return value

    def validate_min_order_value(self, value):
        if value < 0:
            raise serializers.ValidationError("Minimum order can't be negative.")
        return value


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminRole])
def shop_settings(request):
    shop = ShopSettings.load()
    if request.method == "PATCH":
        s = SettingsSerializer(shop, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        before = audit.snapshot(shop, s.validated_data)
        s.save()
        if changes := audit.diff(before, shop):
            audit.record(request, "update", "settings", 1, "Changed shop settings", changes)
    return Response(SettingsSerializer(shop, context={"request": request}).data)


class TeamSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    is_owner = serializers.BooleanField(source="is_superuser", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "phone", "role", "is_owner", "is_active", "last_login", "date_joined"]

    def get_role(self, user):
        return User.Role.ADMIN if user.is_superuser else user.role


class TeamInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField([User.Role.STAFF, User.Role.ADMIN])


def team_queryset():
    return User.objects.filter(Q(role__in=[User.Role.STAFF, User.Role.ADMIN]) | Q(is_superuser=True)).order_by("id")


@api_view(["GET", "POST"])
@permission_classes([IsAdminRole])
def team(request):
    if request.method == "POST":
        s = TeamInviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        email = s.validated_data["email"].strip().lower()
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).order_by("id").first()
            if user is None:
                user = User.objects.create(username=email, email=email, first_name=s.validated_data["first_name"])
            elif user.is_superuser:
                return Response({"detail": "This person is the owner already."}, status=status.HTTP_400_BAD_REQUEST)
            old = user.role
            user.role = s.validated_data["role"]
            user.save(update_fields=["role"])
            audit.record(request, "team", "user", user.pk, f"Gave {email} {user.get_role_display().lower()} access",
                         {"role": [old, user.role]})
        return Response(TeamSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(TeamSerializer(team_queryset(), many=True).data)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminRole])
def team_member(request, pk):
    user = generics.get_object_or_404(team_queryset(), pk=pk)
    if user == request.user:
        return Response({"detail": "You can't change your own access."}, status=status.HTTP_400_BAD_REQUEST)
    if user.is_superuser:
        return Response({"detail": "The owner's access can only be changed in Django admin."},
                        status=status.HTTP_400_BAD_REQUEST)
    old = user.role
    if request.method == "DELETE":
        user.role = User.Role.CUSTOMER
        summary = f"Removed {user.email} from the team"
    else:
        role = request.data.get("role")
        if role not in (User.Role.STAFF, User.Role.ADMIN):
            return Response({"role": ["Choose staff or admin."]}, status=status.HTTP_400_BAD_REQUEST)
        user.role = role
        summary = f"Changed {user.email} to {user.get_role_display().lower()}"
    user.save(update_fields=["role"])
    audit.record(request, "team", "user", user.pk, summary, {"role": [old, user.role]})
    return Response(TeamSerializer(user).data)


class AuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "user_email", "action", "object_type", "object_id", "summary", "changes", "ip", "created_at"]


class AuditList(generics.ListAPIView):
    serializer_class = AuditSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None
    filterset_fields = ["action", "object_type", "user"]
    search_fields = ["summary", "user_email", "object_id"]
    queryset = AuditLog.objects.all()

    def filter_queryset(self, queryset):
        return super().filter_queryset(queryset)[:300]
