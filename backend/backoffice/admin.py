from django.contrib import admin

from .models import AuditLog, Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("spent_on", "category", "amount", "description", "recorded_by")
    list_filter = ("category", "spent_on")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user_email", "action", "object_type", "object_id", "summary")
    list_filter = ("action", "object_type")
    search_fields = ("summary", "user_email", "object_id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
