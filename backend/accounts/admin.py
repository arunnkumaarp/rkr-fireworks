from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class ShopUserAdmin(UserAdmin):
    list_display = ("username", "phone", "first_name", "role", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (("Shop", {"fields": ("phone", "role")}),)
