from django.conf import settings
from django.db import models
from django.utils import timezone


class Expense(models.Model):
    """Money the shop spends. Profit in the reports is payments received minus these."""

    class Category(models.TextChoices):
        STOCK = "stock", "Stock purchase"
        TRANSPORT = "transport", "Transport"
        PACKING = "packing", "Packing material"
        WAGES = "wages", "Wages"
        RENT = "rent", "Rent"
        UTILITIES = "utilities", "Power, phone, internet"
        MARKETING = "marketing", "Marketing"
        LICENCE = "licence", "Licences and fees"
        OTHER = "other", "Other"

    spent_on = models.DateField(default=timezone.localdate)
    category = models.CharField(max_length=12, choices=Category.choices, default=Category.OTHER)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-spent_on", "-id"]

    def __str__(self):
        return f"{self.get_category_display()} ₹{self.amount}"


class AuditLog(models.Model):
    """Who changed what in the shop admin. Rows are only ever added."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    user_email = models.CharField(max_length=254, blank=True)
    action = models.CharField(max_length=20)
    object_type = models.CharField(max_length=30)
    object_id = models.CharField(max_length=40, blank=True)
    summary = models.CharField(max_length=300)
    changes = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
