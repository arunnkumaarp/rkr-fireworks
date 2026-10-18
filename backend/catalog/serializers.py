from rest_framework import serializers

from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "image", "sort_order", "product_count"]


class ProductSerializer(serializers.ModelSerializer):
    offer_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "code", "name", "category", "category_name", "mrp",
            "discount_percent", "offer_price", "unit", "description",
            "image", "video_url",
        ]
