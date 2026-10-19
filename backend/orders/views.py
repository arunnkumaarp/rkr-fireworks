from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Coupon, Estimate
from .serializers import EstimateCreateSerializer, EstimateSerializer


class EstimateCreateView(generics.CreateAPIView):
    serializer_class = EstimateCreateSerializer
    permission_classes = [IsAuthenticated]


class EstimateDetailView(generics.RetrieveAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        qs = Estimate.objects.prefetch_related("items")
        if not self.request.user.is_shop_staff:
            qs = qs.filter(user=self.request.user)
        return get_object_or_404(qs, number=self.kwargs["number"])


class MyEstimatesView(generics.ListAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Estimate.objects.filter(user=self.request.user).prefetch_related("items")


class CouponCheckSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_coupon(request):
    """Lets checkout show the discount before the estimate is sent. The estimate itself re-checks."""
    s = CouponCheckSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    coupon = Coupon.objects.filter(code=s.validated_data["code"].strip().upper()).first()
    problem = coupon.problem_with(s.validated_data["subtotal"]) if coupon else "This coupon code is not valid."
    if problem:
        return Response({"code": [problem]}, status=400)
    return Response({"code": coupon.code, "description": coupon.description,
                     "discount": f"{coupon.discount_for(s.validated_data['subtotal']):.2f}"})
