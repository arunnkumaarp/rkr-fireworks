from django.contrib import admin

from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "mrp", "discount_percent", "offer_price", "unit", "is_active")
    list_editable = ("mrp", "is_active")
    list_filter = ("category", "unit", "is_active")
    search_fields = ("name", "code")
