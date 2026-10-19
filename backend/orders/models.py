from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class StockError(ValueError):
    """An order needs more of a tracked product than is in stock."""


class Estimate(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        CONFIRMED = "confirmed", "Confirmed"
        PAID = "paid", "Paid"
        PACKED = "packed", "Packed"
        DISPATCHED = "dispatched", "Dispatched"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20, unique=True, null=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="estimates")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    notes = models.TextField(blank=True)

    mrp_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    packing_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    coupon = models.ForeignKey("Coupon", null=True, blank=True, on_delete=models.SET_NULL, related_name="estimates")
    coupon_code = models.CharField(max_length=30, blank=True)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED)
    transport_name = models.CharField(max_length=100, blank=True)
    lr_number = models.CharField("LR number", max_length=50, blank=True)
    dispatch_date = models.DateField(null=True, blank=True)
    delivered_on = models.DateField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, help_text="Only the shop sees this")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.number:
            # RKR26-0001: year + sequential id, assigned once the row has an id.
            self.number = f"RKR{timezone.localdate():%y}-{self.pk:04d}"
            super().save(update_fields=["number"])

    def recalculate(self, packing_percent):
        # Query fresh: a prefetched items cache would still hold edited or deleted rows.
        items = list(EstimateItem.objects.filter(estimate=self))
        self.mrp_total = sum((i.mrp * i.quantity for i in items), Decimal("0"))
        self.subtotal = sum((i.amount for i in items), Decimal("0"))
        self.packing_charge = (self.subtotal * packing_percent / 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.discount = self.coupon.discount_for(self.subtotal) if self.coupon else Decimal("0")
        self.total = self.subtotal - self.discount + self.packing_charge

    @property
    def amount_paid(self):
        """Payments received minus refunds."""
        sums = {row["kind"]: row["s"] for row in self.payments.values("kind").annotate(s=Sum("amount"))}
        return sums.get(Payment.Kind.PAYMENT, Decimal("0")) - sums.get(Payment.Kind.REFUND, Decimal("0"))

    def sync_stock(self, user=None, allow_negative=False):
        """Takes tracked stock when the order is confirmed; gives it back when it is cancelled or reduced.

        Works from the movements already booked against this order, so it is safe to call after any change.
        """
        from catalog.models import Product, StockMovement

        taken = {row["product_id"]: -row["s"] for row in
                 StockMovement.objects.filter(estimate=self).values("product_id").annotate(s=Sum("change"))}
        want = {}
        if self.status in COMMITTED_STATUSES:
            for item in EstimateItem.objects.filter(estimate=self, product__isnull=False):
                want[item.product_id] = want.get(item.product_id, 0) + item.quantity
        products = Product.objects.select_for_update().filter(pk__in=set(taken) | set(want), stock__isnull=False)
        for product in products:
            diff = want.get(product.pk, 0) - taken.get(product.pk, 0)
            if not diff:
                continue
            if diff > 0 and product.stock < diff and not allow_negative:
                raise StockError(f"Only {product.stock} of {product.code}. {product.name} in stock.")
            product.stock -= diff
            product.save(update_fields=["stock", "updated_at"])
            StockMovement.objects.create(
                product=product, change=-diff, balance=product.stock, estimate=self, user=user,
                reason=StockMovement.Reason.ORDER if diff > 0 else StockMovement.Reason.RETURN,
                note=f"{self.number} {self.get_status_display().lower()}")


class EstimateItem(models.Model):
    """Snapshot of the product at the time of the estimate, so later price changes don't alter it."""

    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", null=True, on_delete=models.SET_NULL)
    code = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=5)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    class Meta:
        ordering = ["code"]

    @property
    def amount(self):
        return self.price * self.quantity


# Statuses where the shop has agreed the order: it counts as a sale and holds stock.
COMMITTED_STATUSES = [Estimate.Status.CONFIRMED, Estimate.Status.PAID, Estimate.Status.PACKED,
                      Estimate.Status.DISPATCHED, Estimate.Status.DELIVERED]


class Coupon(models.Model):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Percent off"
        FLAT = "flat", "Rupees off"

    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.PERCENT)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                       help_text="Cap for percent coupons; empty for no cap")
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Empty for unlimited")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    @property
    def times_used(self):
        return self.estimates.exclude(status=Estimate.Status.CANCELLED).count()

    def problem_with(self, subtotal):
        """Why this coupon can't be used on an order of `subtotal` now, or None if it can."""
        today = timezone.localdate()
        if not self.is_active or (self.starts_on and today < self.starts_on):
            return "This coupon is not active."
        if self.ends_on and today > self.ends_on:
            return "This coupon has expired."
        if self.usage_limit is not None and self.times_used >= self.usage_limit:
            return "This coupon has been used up."
        if subtotal < self.min_order:
            return f"This coupon needs an order of at least ₹{self.min_order:.0f}."
        return None

    def discount_for(self, subtotal):
        if self.kind == self.Kind.FLAT:
            amount = self.value
        else:
            amount = (subtotal * self.value / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if self.max_discount is not None:
                amount = min(amount, self.max_discount)
        return max(min(amount, subtotal), Decimal("0"))


class Payment(models.Model):
    """Money received for an estimate, or refunded. Payments are made outside the site (UPI, cash, bank)."""

    class Kind(models.TextChoices):
        PAYMENT = "payment", "Payment"
        REFUND = "refund", "Refund"

    class Method(models.TextChoices):
        UPI = "upi", "UPI"
        CASH = "cash", "Cash"
        BANK = "bank", "Bank transfer"
        CARD = "card", "Card"
        CHEQUE = "cheque", "Cheque"
        OTHER = "other", "Other"

    estimate = models.ForeignKey(Estimate, on_delete=models.PROTECT, related_name="payments")
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.PAYMENT)
    method = models.CharField(max_length=8, choices=Method.choices, default=Method.UPI)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_on = models.DateField(default=timezone.localdate)
    reference = models.CharField(max_length=100, blank=True, help_text="UPI reference, cheque number…")
    note = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-id"]


def payment_status(total, paid, status):
    """unpaid · partial · paid, or for cancelled orders refund_due · closed."""
    if status == Estimate.Status.CANCELLED:
        return "refund_due" if paid > 0 else "closed"
    if paid <= 0:
        return "unpaid"
    return "paid" if paid >= total else "partial"
