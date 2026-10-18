from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Estimate
from .serializers import EstimateCreateSerializer, EstimateSerializer


class EstimateCreateView(generics.CreateAPIView):
    serializer_class = EstimateCreateSerializer
    permission_classes = [IsAuthenticated]


class EstimateDetailView(generics.RetrieveAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        qs = Estimate.objects.prefetch_related("items")
        if not self.request.user.is_shop_admin:
            qs = qs.filter(user=self.request.user)
        return get_object_or_404(qs, number=self.kwargs["number"])


class MyEstimatesView(generics.ListAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Estimate.objects.filter(user=self.request.user).prefetch_related("items")
