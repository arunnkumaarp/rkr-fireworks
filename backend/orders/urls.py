from django.urls import path

from .views import EstimateCreateView, EstimateDetailView, MyEstimatesView, check_coupon

urlpatterns = [
    path("estimates/", EstimateCreateView.as_view(), name="estimate-create"),
    path("estimates/mine/", MyEstimatesView.as_view(), name="estimate-mine"),
    path("estimates/<str:number>/", EstimateDetailView.as_view(), name="estimate-detail"),
    path("coupons/check/", check_coupon, name="coupon-check"),
]
