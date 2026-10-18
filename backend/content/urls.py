from django.urls import path

from .views import public_settings

urlpatterns = [
    path("settings/public/", public_settings, name="public-settings"),
]
