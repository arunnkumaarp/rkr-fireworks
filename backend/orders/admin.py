from django.contrib import admin, messages

from .models import Coupon, Estimate, EstimateItem, Payment, StockError


class EstimateItemInline(admin.TabularInline):
    model = EstimateItem
    extra = 0
    fields = ("code", "name", "unit", "mrp", "price", "quantity")
    readonly_fields = ("code", "name", "unit", "mrp")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ("kind", "method", "amount", "paid_on", "reference", "note")


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ("number", "customer_name", "phone", "city", "total", "status", "created_at")
    list_filter = ("status", "state", "created_at")
    list_editable = ("status",)
    search_fields = ("number", "customer_name", "phone")
    readonly_fields = ("number", "mrp_total", "subtotal", "packing_charge", "coupon_code", "discount", "total",
                       "created_at")
    inlines = [EstimateItemInline, PaymentInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Keep tracked stock in step with status changes made here too.
        try:
            form.instance.sync_stock(user=request.user)
        except StockError as e:
            form.instance.sync_stock(user=request.user, allow_negative=True)
            messages.warning(request, f"{e} Stock is now below zero; recount it in the shop admin.")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "kind", "value", "min_order", "starts_on", "ends_on", "is_active")
    list_filter = ("is_active", "kind")
    search_fields = ("code",)
