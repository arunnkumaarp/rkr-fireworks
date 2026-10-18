from django.contrib import admin

from .models import Estimate, EstimateItem


class EstimateItemInline(admin.TabularInline):
    model = EstimateItem
    extra = 0
    fields = ("code", "name", "unit", "mrp", "price", "quantity")
    readonly_fields = ("code", "name", "unit", "mrp")


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ("number", "customer_name", "phone", "city", "total", "status", "created_at")
    list_filter = ("status", "state", "created_at")
    list_editable = ("status",)
    search_fields = ("number", "customer_name", "phone")
    readonly_fields = ("number", "mrp_total", "subtotal", "packing_charge", "total", "created_at")
    inlines = [EstimateItemInline]
