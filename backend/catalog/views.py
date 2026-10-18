from django.db.models import Count, Q
from rest_framework import viewsets

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(is_active=True).annotate(
            product_count=Count("products", filter=Q(products__is_active=True))
        ).order_by("sort_order", "name")  # Meta.ordering is dropped on GROUP BY queries


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductSerializer
    filterset_fields = {"category": ["exact"], "category__slug": ["exact"]}
    search_fields = ["name", "=code"]
    # The quick-order page lists the whole catalogue at once, so no pagination.
    pagination_class = None

    def get_queryset(self):
        return Product.objects.filter(is_active=True, category__is_active=True).select_related("category")
