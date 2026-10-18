from django.urls import path

from .views import EstimateCreateView, EstimateDetailView, MyEstimatesView

urlpatterns = [
    path("estimates/", EstimateCreateView.as_view(), name="estimate-create"),
    path("estimates/mine/", MyEstimatesView.as_view(), name="estimate-mine"),
    path("estimates/<str:number>/", EstimateDetailView.as_view(), name="estimate-detail"),
]
