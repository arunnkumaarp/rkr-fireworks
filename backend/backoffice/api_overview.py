import csv
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncYear
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdminRole, IsStaffRole
from catalog.models import Product
from orders.models import COMMITTED_STATUSES, Estimate, EstimateItem, Payment

from .audit import AuditedMixin
from .models import Expense
from .queries import PAYMENT_FILTERS, parse_date, signed_amount, with_paid

ZERO = Decimal("0")


def money(value):
    return f"{value or ZERO:.2f}"


def net_received(qs):
    return qs.aggregate(s=Sum(signed_amount()))["s"] or ZERO


def outstanding_total():
    rows = with_paid(Estimate.objects.filter(status__in=COMMITTED_STATUSES)).filter(paid__lt=F("total"))
    return sum((e.total - e.paid for e in rows.only("total")), ZERO)


@api_view(["GET"])
@permission_classes([IsStaffRole])
def dashboard(request):
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    S = Estimate.Status
    counts = Estimate.objects.aggregate(
        today=Count("id", filter=Q(created_at__date=today)),
        this_week=Count("id", filter=Q(created_at__date__gte=week_start)),
        this_month=Count("id", filter=Q(created_at__date__gte=month_start)),
        awaiting_call=Count("id", filter=Q(status=S.SUBMITTED)),
        confirmed=Count("id", filter=Q(status=S.CONFIRMED)),
        processing=Count("id", filter=Q(status__in=[S.PAID, S.PACKED])),
        to_dispatch=Count("id", filter=Q(status__in=[S.PAID, S.PACKED])),
        in_transit=Count("id", filter=Q(status=S.DISPATCHED)),
        completed=Count("id", filter=Q(status=S.DELIVERED)),
        cancelled=Count("id", filter=Q(status=S.CANCELLED)),
        confirmed_orders=Count("id", filter=Q(status__in=COMMITTED_STATUSES)),
        confirmed_value=Sum("total", filter=Q(status__in=COMMITTED_STATUSES)),
        month_sales=Sum("total", filter=Q(status__in=COMMITTED_STATUSES, created_at__date__gte=month_start)),
    )
    stock = Product.objects.aggregate(
        out_of_stock=Count("id", filter=Q(stock__lte=0)),
        low_stock=Count("id", filter=Q(stock__gt=0, stock__lte=F("low_stock_threshold"))))
    top = (EstimateItem.objects.filter(estimate__status__in=COMMITTED_STATUSES + [S.SUBMITTED])
           .values("code", "name").annotate(quantity=Sum("quantity")).order_by("-quantity")[:10])
    recent = Estimate.objects.order_by("-created_at")[:6]

    # Daily order value for the last 30 days (confirmed orders, by the day they were placed).
    start = today - timedelta(days=29)
    by_day = dict(Estimate.objects.filter(status__in=COMMITTED_STATUSES, created_at__date__gte=start)
                  .annotate(d=TruncDate("created_at")).values("d").annotate(v=Sum("total")).values_list("d", "v"))
    series = [{"date": (start + timedelta(days=i)).isoformat(), "sales": money(by_day.get(start + timedelta(days=i)))}
              for i in range(30)]

    data = {**counts, **stock,
            "confirmed_value": money(counts["confirmed_value"]), "month_sales": money(counts["month_sales"]),
            "top_products": list(top), "series": series,
            "recent": [{"number": e.number, "customer_name": e.customer_name, "city": e.city, "total": money(e.total),
                        "status": e.status, "created_at": e.created_at} for e in recent]}

    if request.user.is_shop_admin:
        payments = Payment.objects.all()
        received_month = net_received(payments.filter(paid_on__gte=month_start))
        expenses_month = Expense.objects.filter(spent_on__gte=month_start).aggregate(s=Sum("amount"))["s"] or ZERO
        data["money"] = {
            "received_total": money(net_received(payments)),
            "received_month": money(received_month),
            "expenses_month": money(expenses_month),
            "profit_month": money(received_month - expenses_month),
            "outstanding": money(outstanding_total()),
        }
    return Response(data)


def _alert(kind, key, title, body, link, at, tone):
    return {"id": f"{kind}-{key}", "kind": kind, "title": title, "body": body, "link": link, "at": at, "tone": tone}


def build_alerts(user):
    today = timezone.localdate()
    S = Estimate.Status
    alerts = []
    for e in Estimate.objects.filter(status=S.SUBMITTED).order_by("-created_at")[:25]:
        alerts.append(_alert("new_order", e.number, f"New estimate {e.number}",
                             f"{e.customer_name}, {e.city} · ₹{e.total:,.0f}. Call to confirm.",
                             f"/admin/estimates/{e.number}", e.created_at, "alert"))
    for p in Product.objects.filter(stock__lte=F("low_stock_threshold")).order_by("stock")[:30]:
        out = p.stock <= 0
        alerts.append(_alert("stock", p.pk, f"{'Out of stock' if out else 'Low stock'}: {p.name}",
                             "Hidden from the price list until restocked." if out else f"{p.stock} left.",
                             "/admin/inventory", p.updated_at, "alert" if out else "warn"))
    for e in Estimate.objects.filter(status__in=[S.PAID, S.PACKED]).order_by("updated_at")[:25]:
        alerts.append(_alert("dispatch", e.number, f"Ready to dispatch: {e.number}",
                             f"{e.customer_name}, {e.city} · {e.get_status_display().lower()}.",
                             "/admin/dispatch", e.updated_at, "warn"))
    late = today - timedelta(days=10)
    for e in Estimate.objects.filter(status=S.DISPATCHED, dispatch_date__lte=late)[:25]:
        alerts.append(_alert("transit", e.number, f"Still in transit: {e.number}",
                             f"Dispatched {e.dispatch_date:%d %b} with {e.transport_name or 'transport'}. "
                             "Check delivery.", "/admin/dispatch", e.updated_at, "warn"))
    if user.is_shop_admin:
        follow_up = timezone.now() - timedelta(days=2)
        for e in with_paid(Estimate.objects.filter(status=S.CONFIRMED, updated_at__lte=follow_up)).filter(
                PAYMENT_FILTERS["unpaid"])[:25]:
            alerts.append(_alert("payment", e.number, f"Payment pending: {e.number}",
                                 f"{e.customer_name} · ₹{e.total:,.0f} confirmed, nothing received yet.",
                                 f"/admin/estimates/{e.number}", e.updated_at, "warn"))
        for e in with_paid(Estimate.objects.all()).filter(PAYMENT_FILTERS["refund_due"])[:25]:
            alerts.append(_alert("refund", e.number, f"Refund due: {e.number}",
                                 f"Cancelled with ₹{e.paid:,.0f} still held.", f"/admin/estimates/{e.number}",
                                 e.updated_at, "alert"))
    alerts.sort(key=lambda a: a["at"], reverse=True)
    return alerts


@api_view(["GET"])
@permission_classes([IsStaffRole])
def notifications(request):
    alerts = build_alerts(request.user)
    seen = request.user.notifications_seen_at
    for a in alerts:
        a["unread"] = seen is None or a["at"] > seen
    return Response({"unread": sum(a["unread"] for a in alerts), "items": alerts})


@api_view(["POST"])
@permission_classes([IsStaffRole])
def notifications_seen(request):
    request.user.notifications_seen_at = timezone.now()
    request.user.save(update_fields=["notifications_seen_at"])
    return Response({"unread": 0})


# ---------- reports ----------

TRUNC = {"day": TruncDate, "month": TruncMonth, "year": TruncYear}


def _periods(start, end, group):
    keys, d = [], start
    while d <= end:
        key = d if group == "day" else d.replace(day=1) if group == "month" else d.replace(month=1, day=1)
        if not keys or keys[-1] != key:
            keys.append(key)
        d += timedelta(days=1)
    return keys


def _as_date(v):
    return v.date() if isinstance(v, datetime) else v


def _sum_by(qs, field, value, group):
    rows = qs.annotate(k=TRUNC[group](field)).values("k").annotate(v=value).values_list("k", "v")
    out = {}
    for k, v in rows:
        k = _as_date(k)
        out[k] = out.get(k, ZERO) + (v or ZERO)
    return out


def build_report(params):
    today = timezone.localdate()
    end = parse_date(params.get("to")) or today
    start = parse_date(params.get("from")) or end.replace(day=1)
    if start > end:
        start, end = end, start
    span = (end - start).days
    group = params.get("group")
    if group not in TRUNC:
        group = "day" if span <= 62 else "month" if span <= 3 * 366 else "year"
    if group == "day" and span > 400:
        group = "month"  # keeps the table and chart readable

    placed = Estimate.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
    committed = placed.filter(status__in=COMMITTED_STATUSES)
    payments = Payment.objects.filter(paid_on__gte=start, paid_on__lte=end)
    expenses = Expense.objects.filter(spent_on__gte=start, spent_on__lte=end)

    orders = _sum_by(placed.exclude(status=Estimate.Status.CANCELLED), "created_at", Count("id"), group)
    sales = _sum_by(committed, "created_at", Sum("total"), group)
    received = _sum_by(payments, "paid_on", Sum(signed_amount()), group)
    spent = _sum_by(expenses, "spent_on", Sum("amount"), group)

    rows = []
    for k in _periods(start, end, group):
        r, x = received.get(k, ZERO), spent.get(k, ZERO)
        rows.append({"period": k.isoformat(), "orders": int(orders.get(k, 0)), "sales": money(sales.get(k)),
                     "received": money(r), "expenses": money(x), "profit": money(r - x)})

    total_received, total_spent = sum(received.values(), ZERO), sum(spent.values(), ZERO)
    return {
        "from": start.isoformat(), "to": end.isoformat(), "group": group, "rows": rows,
        "totals": {"orders": int(sum(orders.values())), "sales": money(sum(sales.values(), ZERO)),
                   "received": money(total_received), "expenses": money(total_spent),
                   "profit": money(total_received - total_spent),
                   "cancelled": placed.filter(status=Estimate.Status.CANCELLED).count()},
        "expenses_by_category": [
            {"category": r["category"], "label": Expense.Category(r["category"]).label, "amount": money(r["s"])}
            for r in expenses.values("category").annotate(s=Sum("amount")).order_by("-s")],
        "received_by_method": [
            {"method": r["method"], "label": Payment.Method(r["method"]).label, "amount": money(r["s"])}
            for r in payments.values("method").annotate(s=Sum(signed_amount())).order_by("-s")],
        "top_products": [
            {"code": r["code"], "name": r["name"], "quantity": r["q"], "amount": money(r["a"])}
            for r in EstimateItem.objects.filter(estimate__in=committed).values("code", "name")
            .annotate(q=Sum("quantity"), a=Sum(F("price") * F("quantity"))).order_by("-a")[:10]],
    }


@api_view(["GET"])
@permission_classes([IsAdminRole])
def reports(request):
    report = build_report(request.query_params)
    kind = request.query_params.get("download")
    if kind not in ("summary", "orders"):
        return Response(report)

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="rkr-{kind}-{report["from"]}-to-{report["to"]}.csv"'
    response.write("﻿")  # so Excel reads the rupee sign and Tamil names correctly
    w = csv.writer(response)
    if kind == "summary":
        w.writerow(["Period", "Orders", "Confirmed sales", "Money received", "Expenses", "Profit (received − expenses)"])
        for r in report["rows"]:
            w.writerow([r["period"], r["orders"], r["sales"], r["received"], r["expenses"], r["profit"]])
        t = report["totals"]
        w.writerow(["Total", t["orders"], t["sales"], t["received"], t["expenses"], t["profit"]])
    else:
        w.writerow(["Number", "Date", "Customer", "Phone", "City", "Status", "Subtotal", "Discount", "Packing",
                    "Total", "Paid", "Balance", "Transport", "LR number"])
        rows = with_paid(Estimate.objects.filter(created_at__date__gte=report["from"],
                                                 created_at__date__lte=report["to"])).order_by("created_at")
        for e in rows:
            balance = ZERO if e.status == Estimate.Status.CANCELLED else max(e.total - e.paid, ZERO)
            w.writerow([e.number, timezone.localtime(e.created_at).strftime("%Y-%m-%d %H:%M"), e.customer_name,
                        e.phone, e.city, e.get_status_display(), e.subtotal, e.discount, e.packing_charge, e.total,
                        money(e.paid), money(balance), e.transport_name, e.lr_number])
    return response


# ---------- expenses ----------

class ExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    recorded_by = serializers.CharField(source="recorded_by.email", read_only=True, default="")

    class Meta:
        model = Expense
        fields = ["id", "spent_on", "category", "category_label", "amount", "description", "recorded_by",
                  "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount above zero.")
        return value

    def validate_spent_on(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("The date can't be in the future.")
        return value


class ExpenseAudit(AuditedMixin):
    audit_type = "expense"
    serializer_class = ExpenseSerializer
    permission_classes = [IsAdminRole]

    def describe(self, e):
        return f"expense {e.get_category_display()} ₹{e.amount} on {e.spent_on}"

    def save_kwargs(self):
        return {"recorded_by": self.request.user}

    def get_queryset(self):
        qs = Expense.objects.select_related("recorded_by")
        params = self.request.query_params
        if start := parse_date(params.get("from")):
            qs = qs.filter(spent_on__gte=start)
        if end := parse_date(params.get("to")):
            qs = qs.filter(spent_on__lte=end)
        return qs


class ExpenseList(ExpenseAudit, generics.ListCreateAPIView):
    pagination_class = None
    filterset_fields = ["category"]
    search_fields = ["description"]


class ExpenseDetail(ExpenseAudit, generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete"]

