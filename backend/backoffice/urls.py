from django.urls import path

from . import api_catalog as cat
from . import api_orders as orders
from . import api_overview as overview
from . import api_people as people

# Everything here is under /api/v1/admin/ and needs a staff or admin login (see each view's permission).
urlpatterns = [
    path("dashboard/", overview.dashboard, name="admin-dashboard"),
    path("notifications/", overview.notifications, name="admin-notifications"),
    path("notifications/seen/", overview.notifications_seen, name="admin-notifications-seen"),
    path("reports/", overview.reports, name="admin-reports"),
    path("expenses/", overview.ExpenseList.as_view(), name="admin-expenses"),
    path("expenses/<int:pk>/", overview.ExpenseDetail.as_view(), name="admin-expense"),

    path("estimates/", orders.AdminEstimateList.as_view(), name="admin-estimates"),
    path("estimates/<str:number>/", orders.AdminEstimateDetail.as_view(), name="admin-estimate"),
    path("payments/", orders.PaymentList.as_view(), name="admin-payments"),
    path("payments/summary/", orders.payments_summary, name="admin-payments-summary"),
    path("payments/<int:pk>/", orders.PaymentDetail.as_view(), name="admin-payment"),

    path("products/", cat.AdminProductList.as_view(), name="admin-products"),
    path("products/<int:pk>/", cat.AdminProductDetail.as_view(), name="admin-product"),
    path("products/<int:pk>/stock/", cat.change_stock, name="admin-product-stock"),
    path("categories/", cat.CategoryList.as_view(), name="admin-categories"),
    path("categories/<int:pk>/", cat.CategoryDetail.as_view(), name="admin-category"),
    path("inventory/", cat.inventory_summary, name="admin-inventory"),
    path("stock-movements/", cat.StockMovementList.as_view(), name="admin-stock-movements"),
    path("offers/", cat.OfferList.as_view(), name="admin-offers"),
    path("offers/<int:pk>/", cat.OfferDetail.as_view(), name="admin-offer"),
    path("coupons/", cat.CouponList.as_view(), name="admin-coupons"),
    path("coupons/<int:pk>/", cat.CouponDetail.as_view(), name="admin-coupon"),

    path("customers/", people.CustomerList.as_view(), name="admin-customers"),
    path("customers/<int:pk>/", people.CustomerDetail.as_view(), name="admin-customer"),
    path("settings/", people.shop_settings, name="admin-settings"),
    path("team/", people.team, name="admin-team"),
    path("team/<int:pk>/", people.team_member, name="admin-team-member"),
    path("audit/", people.AuditList.as_view(), name="admin-audit"),
]
