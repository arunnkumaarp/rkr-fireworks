from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import NotFound

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
