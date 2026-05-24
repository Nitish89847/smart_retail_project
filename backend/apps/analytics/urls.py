from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard_summary, name='dashboard'),
    path('revenue-trend/', views.monthly_revenue_trend, name='revenue-trend'),
    path('daily-trend/', views.sales_trend_daily, name='daily-trend'),
    path('category-performance/', views.category_performance, name='category-performance'),
    path('inventory-status/', views.inventory_status_breakdown, name='inventory-status'),
    path('restock-suggestions/', views.restock_suggestions_view, name='restock-suggestions'),
    path('top-products/', views.top_products, name='top-products'),
]
