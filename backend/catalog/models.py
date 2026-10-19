from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=110, unique=True)
    image = models.ImageField(upload_to="categories/", blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    class Unit(models.TextChoices):
        BOX = "Box", "Box"
        PKT = "PKT", "Packet"
        PCS = "Pcs", "Pieces"

    code = models.PositiveIntegerField(unique=True, help_text="Code from the printed price list")
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("80"))
    unit = models.CharField(max_length=5, choices=Unit.choices, default=Unit.BOX)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="products/", blank=True)
    video_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    # Empty means stock is not tracked for this product (the default for the printed list).
    stock = models.IntegerField(null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def effective_discount(self):
        """The product's own discount, or a running seasonal offer if that is bigger."""
        best = self.discount_percent
        for offer in Offer.running():
            if offer["category_id"] in (None, self.category_id) and offer["discount_percent"] > best:
                best = offer["discount_percent"]
        return best

    @property
    def offer_price(self):
        price = self.mrp * (Decimal("100") - self.effective_discount) / Decimal("100")
        return price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @property
    def stock_state(self):
        if self.stock is None:
            return "untracked"
        if self.stock <= 0:
            return "out"
        return "low" if self.stock <= self.low_stock_threshold else "ok"


class StockMovement(models.Model):
    """Every change to a tracked product's stock, so the count can be explained later."""

    class Reason(models.TextChoices):
        RESTOCK = "restock", "Restock"
        ADJUSTMENT = "adjustment", "Count correction"
        ORDER = "order", "Order confirmed"
        RETURN = "return", "Order cancelled or reduced"
        DAMAGE = "damage", "Damaged or lost"
        TRACKING = "tracking", "Tracking started"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    change = models.IntegerField()
    balance = models.IntegerField()
    reason = models.CharField(max_length=12, choices=Reason.choices)
    estimate = models.ForeignKey("orders.Estimate", null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=200, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class Offer(models.Model):
    """A dated discount for one category or the whole list. The bigger of it and a product's own discount wins."""

    CACHE_KEY = "catalog:running-offers"

    name = models.CharField(max_length=100)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.CASCADE,
                                 help_text="Empty applies to every product")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    starts_on = models.DateField()
    ends_on = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-starts_on", "name"]

    def __str__(self):
        return self.name

    @property
    def is_running(self):
        return self.is_active and self.starts_on <= timezone.localdate() <= self.ends_on

    @classmethod
    def running(cls):
        # Read on every price, so cached for a minute; saving an offer clears it.
        offers = cache.get(cls.CACHE_KEY)
        if offers is None:
            today = timezone.localdate()
            offers = list(cls.objects.filter(is_active=True, starts_on__lte=today, ends_on__gte=today)
                          .values("category_id", "discount_percent"))
            cache.set(cls.CACHE_KEY, offers, 60)
        return offers

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)

    def delete(self, *args, **kwargs):
        result = super().delete(*args, **kwargs)
        cache.delete(self.CACHE_KEY)
        return result
