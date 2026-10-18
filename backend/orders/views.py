from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated

from .models import Estimate
from .serializers import EstimateCreateSerializer, EstimateSerializer


class EstimateCreateView(generics.CreateAPIView):
    serializer_class = EstimateCreateSerializer


class EstimateDetailView(generics.RetrieveAPIView):
    """Guest lookup: the estimate number plus the phone it was placed with."""

    serializer_class = EstimateSerializer

    def get_object(self):
        phone = "".join(ch for ch in self.request.query_params.get("phone", "") if ch.isdigit())[-10:]
        if not phone:
            raise NotFound()
        return get_object_or_404(
            Estimate.objects.prefetch_related("items"), number=self.kwargs["number"], phone=phone)


class MyEstimatesView(generics.ListAPIView):
    serializer_class = EstimateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Estimate.objects.filter(user=self.request.user).prefetch_related("items")
