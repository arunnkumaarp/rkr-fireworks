from decimal import ROUND_HALF_UP, Decimal

from django.db import models


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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def offer_price(self):
        price = self.mrp * (Decimal("100") - self.discount_percent) / Decimal("100")
        return price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
