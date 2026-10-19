from datetime import date
from decimal import Decimal

from django.db.models import Case, DecimalField, F, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce

from orders.models import COMMITTED_STATUSES, Estimate, Payment

MONEY = DecimalField(max_digits=12, decimal_places=2)
ZERO = Value(Decimal("0"), output_field=MONEY)

# Groups of statuses the admin screens filter by.
STAGES = {
    "new": [Estimate.Status.SUBMITTED],
    "open": [s for s in Estimate.Status.values if s not in (Estimate.Status.DELIVERED, Estimate.Status.CANCELLED)],
    "confirmed": [Estimate.Status.CONFIRMED],
    "processing": [Estimate.Status.PAID, Estimate.Status.PACKED],
    "to_dispatch": [Estimate.Status.CONFIRMED, Estimate.Status.PAID, Estimate.Status.PACKED],
    "dispatched": [Estimate.Status.DISPATCHED],
    "completed": [Estimate.Status.DELIVERED],
    "cancelled": [Estimate.Status.CANCELLED],
    "committed": COMMITTED_STATUSES,
}


def signed_amount():
    return Case(When(kind=Payment.Kind.REFUND, then=-F("amount")), default=F("amount"), output_field=MONEY)


def with_paid(qs):
    """Adds `paid`: money received minus refunds, per estimate, in one query."""
    paid = (Payment.objects.filter(estimate=OuterRef("pk")).values("estimate")
            .annotate(s=Sum(signed_amount())).values("s"))
    return qs.annotate(paid=Coalesce(Subquery(paid, output_field=MONEY), ZERO))


PAYMENT_FILTERS = {
    "unpaid": Q(paid__lte=0) & ~Q(status=Estimate.Status.CANCELLED),
    "partial": Q(paid__gt=0, paid__lt=F("total")) & ~Q(status=Estimate.Status.CANCELLED),
    "paid": Q(paid__gte=F("total"), paid__gt=0) & ~Q(status=Estimate.Status.CANCELLED),
    "refund_due": Q(paid__gt=0, status=Estimate.Status.CANCELLED),
}


def parse_date(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None
