from django.urls import path

from .views import EstimateCreateView, EstimateDetailView

urlpatterns = [
    path("estimates/", EstimateCreateView.as_view(), name="estimate-create"),
    path("estimates/<str:number>/", EstimateDetailView.as_view(), name="estimate-detail"),
]
