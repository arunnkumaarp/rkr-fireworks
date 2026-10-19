from datetime import date, datetime
from decimal import Decimal

from django.db import models

from .models import AuditLog


def _plain(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (Decimal, date, datetime, models.Model)):
        return str(value)
    return repr(value)


def record(request, action, object_type, object_id, summary, changes=None):
    user = getattr(request, "user", None)
    user = user if user is not None and user.is_authenticated else None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    AuditLog.objects.create(
        user=user, user_email=user.email if user else "", action=action, object_type=object_type,
        object_id=str(object_id or ""), summary=summary[:300], changes=changes or {},
        ip=(forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR")) or None,
    )


def snapshot(instance, fields):
    return {f: getattr(instance, f) for f in fields}


def diff(before, instance):
    return {f: [_plain(old), _plain(getattr(instance, f))] for f, old in before.items() if old != getattr(instance, f)}


class AuditedMixin:
    """Logs creates, updates and deletes made through a DRF generic view."""

    audit_type = ""

    def describe(self, obj):
        return str(obj)

    def save_kwargs(self):
        return {}

    def perform_create(self, serializer):
        obj = serializer.save(**self.save_kwargs())
        record(self.request, "create", self.audit_type, obj.pk, f"Added {self.describe(obj)}",
               {k: _plain(v) for k, v in serializer.validated_data.items()})

    def perform_update(self, serializer):
        before = snapshot(serializer.instance, serializer.validated_data)
        obj = serializer.save()
        changes = diff(before, obj)
        if changes:
            record(self.request, "update", self.audit_type, obj.pk, f"Changed {self.describe(obj)}", changes)

    def perform_destroy(self, instance):
        record(self.request, "delete", self.audit_type, instance.pk, f"Deleted {self.describe(instance)}")
        instance.delete()
