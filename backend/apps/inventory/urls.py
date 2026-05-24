from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('categories', views.CategoryViewSet, basename='category')
router.register('products', views.ProductViewSet, basename='product')
router.register('movements', views.StockMovementViewSet, basename='movement')

urlpatterns = [
    path('', include(router.urls)),
]
