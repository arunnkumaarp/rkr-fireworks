import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        ADMIN = "admin", "Admin"

    phone = models.CharField(max_length=15, blank=True, default="")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)

    @property
    def is_shop_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser


class EmailOTP(models.Model):
    """One-time login code sent by email. Only a hash of the code is stored."""

    TTL = timedelta(minutes=10)
    RESEND_AFTER = timedelta(seconds=60)
    MAX_ATTEMPTS = 5

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def _hash(email, code):
        return salted_hmac("email-otp", f"{email}:{code}").hexdigest()

    @classmethod
    def issue(cls, email):
        code = f"{secrets.randbelow(10**6):06d}"
        cls.objects.filter(email=email, used=False).update(used=True)
        cls.objects.create(email=email, code_hash=cls._hash(email, code))
        return code

    @classmethod
    def latest_for(cls, email):
        return cls.objects.filter(email=email).first()

    @property
    def expired(self):
        return timezone.now() - self.created_at > self.TTL

    def check_code(self, code):
        """Counts the attempt; returns True once for the right code within limits."""
        if self.used or self.expired or self.attempts >= self.MAX_ATTEMPTS:
            return False
        self.attempts += 1
        ok = constant_time_compare(self.code_hash, self._hash(self.email, code))
        if ok:
            self.used = True
        self.save(update_fields=["attempts", "used"])
        return ok
