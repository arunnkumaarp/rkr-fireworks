from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import EmailOTP, User


@admin.register(User)
class ShopUserAdmin(UserAdmin):
    list_display = ("username", "phone", "first_name", "role", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (("Shop", {"fields": ("phone", "role")}),)


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    list_display = ("email", "created_at", "attempts", "used")
    readonly_fields = ("email", "code_hash", "created_at", "attempts", "used")
