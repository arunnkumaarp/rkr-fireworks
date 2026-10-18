import csv
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from catalog.models import Category, Product

DEFAULT_CSV = Path(__file__).resolve().parents[3] / "seed" / "products_2026.csv"


class Command(BaseCommand):
    help = "Create or update categories and products from a price-list CSV (code,name,category,mrp,unit)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", nargs="?", default=str(DEFAULT_CSV))
        parser.add_argument("--discount", type=Decimal, default=None,
                            help="Set this discount %% on every imported product")

    @transaction.atomic
    def handle(self, csv_path, discount, **options):
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        categories = {}
        created = updated = 0
        for row in rows:
            cat_name = row["category"].strip()
            if cat_name not in categories:
                categories[cat_name], _ = Category.objects.update_or_create(
                    slug=slugify(cat_name),
                    defaults={"name": cat_name, "sort_order": len(categories) + 1},
                )
            defaults = {
                "name": row["name"].strip(),
                "category": categories[cat_name],
                "mrp": Decimal(row["mrp"]),
                "unit": row["unit"].strip(),
            }
            if discount is not None:
                defaults["discount_percent"] = discount
            _, was_created = Product.objects.update_or_create(code=int(row["code"]), defaults=defaults)
            created += was_created
            updated += not was_created

        self.stdout.write(self.style.SUCCESS(
            f"{len(categories)} categories, {created} products created, {updated} updated"
        ))
