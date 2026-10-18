from django.urls import path

from .views import EstimateCreateView, EstimateDetailView, MyEstimatesView

urlpatterns = [
    path("estimates/", EstimateCreateView.as_view(), name="estimate-create"),
    path("estimates/mine/", MyEstimatesView.as_view(), name="estimate-mine"),
    path("estimates/<str:number>/", EstimateDetailView.as_view(), name="estimate-detail"),
]

from . import admin_api  # noqa: E402

urlpatterns += [
    path("admin/dashboard/", admin_api.dashboard, name="admin-dashboard"),
    path("admin/estimates/", admin_api.AdminEstimateList.as_view(), name="admin-estimates"),
    path("admin/estimates/<str:number>/", admin_api.AdminEstimateDetail.as_view(), name="admin-estimate"),
    path("admin/products/", admin_api.AdminProductList.as_view(), name="admin-products"),
    path("admin/products/<int:pk>/", admin_api.AdminProductDetail.as_view(), name="admin-product"),
]
