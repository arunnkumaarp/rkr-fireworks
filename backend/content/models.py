from decimal import Decimal

from django.db import models


class ShopSettings(models.Model):
    """Single-row table holding shop-wide settings."""

    shop_name = models.CharField(max_length=100, default="RKR Crackers")
    phone_primary = models.CharField(max_length=15, default="9500403856")
    phone_secondary = models.CharField(max_length=15, blank=True, default="9176020261")
    whatsapp_number = models.CharField(max_length=15, blank=True, default="9500403856")
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1000"))
    packing_charge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    upi_id = models.CharField(max_length=100, blank=True)
    upi_qr = models.ImageField(upload_to="payment/", blank=True, help_text="UPI QR code shown after an estimate is submitted")
    bank_details = models.TextField(blank=True)
    announcement = models.CharField(max_length=200, blank=True, default="80% Discount on all products")

    class Meta:
        verbose_name_plural = "shop settings"

    def __str__(self):
        return self.shop_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
