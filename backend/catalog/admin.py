from django.contrib import admin

from .models import Category, Offer, Product, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "mrp", "discount_percent", "offer_price", "unit", "stock", "is_active")
    readonly_fields = ("stock",)
    list_editable = ("mrp", "is_active")
    list_filter = ("category", "unit", "is_active")
    search_fields = ("name", "code")


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "discount_percent", "starts_on", "ends_on", "is_active")
    list_filter = ("is_active",)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("created_at", "product", "change", "balance", "reason", "estimate", "user")
    list_filter = ("reason",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
