from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


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
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED)
    transport_name = models.CharField(max_length=100, blank=True)
    lr_number = models.CharField("LR number", max_length=50, blank=True)
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
        self.total = self.subtotal + self.packing_charge


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
