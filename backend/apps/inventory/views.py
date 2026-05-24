"""
Inventory views — ALL querysets filtered by request.user.
A logged-in user can only see and modify their own products, categories, and stock.
"""
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Category, Product, Inventory, StockMovement
from .serializers import (
    CategorySerializer, ProductSerializer, ProductCreateSerializer,
    StockMovementSerializer, UpdateStockSerializer
)


class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD for categories — scoped to the logged-in user."""
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):
        # Only return this user's categories
        return Category.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # Auto-set owner to logged-in user on create
        serializer.save(owner=self.request.user)


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD for products — scoped to the logged-in user."""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['name', 'price', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        # Core security: only this user's products
        return Product.objects.filter(
            owner=self.request.user, is_active=True
        ).select_related('category', 'inventory')

    def get_serializer_class(self):
        if self.action == 'create':
            return ProductCreateSerializer
        return ProductSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], url_path='update-stock')
    def update_stock(self, request, pk=None):
        """Adjust stock for one of the user's products."""
        product = self.get_object()   # already filtered by owner via get_queryset
        serializer = UpdateStockSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        quantity = serializer.validated_data['quantity']
        movement_type = serializer.validated_data['movement_type']
        notes = serializer.validated_data.get('notes', '')

        inventory = product.inventory
        new_qty = inventory.quantity + quantity
        if new_qty < 0:
            return Response(
                {'error': f'Insufficient stock. Current stock: {inventory.quantity}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        inventory.quantity = new_qty
        if movement_type == 'purchase':
            inventory.last_restocked = timezone.now()
        inventory.save()

        StockMovement.objects.create(
            product=product, movement_type=movement_type,
            quantity=quantity, notes=notes, created_by=request.user
        )

        return Response({
            'message': 'Stock updated successfully',
            'new_quantity': inventory.quantity,
            'stock_status': inventory.stock_status
        })

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        """All low-stock products belonging to the logged-in user."""
        result = [
            p for p in self.get_queryset()
            if hasattr(p, 'inventory') and p.inventory.is_low_stock
        ]
        return Response({'count': len(result), 'results': ProductSerializer(result, many=True).data})

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Stock health counts for the logged-in user's products."""
        in_stock = low_stock = out_of_stock = 0
        for p in self.get_queryset():
            if hasattr(p, 'inventory'):
                s = p.inventory.stock_status
                if s == 'in_stock': in_stock += 1
                elif s == 'low_stock': low_stock += 1
                else: out_of_stock += 1
        return Response({
            'total_products': in_stock + low_stock + out_of_stock,
            'in_stock': in_stock,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock,
        })


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit log — only movements for the logged-in user's products."""
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['movement_type']
    ordering = ['-created_at']

    def get_queryset(self):
        return StockMovement.objects.filter(
            product__owner=self.request.user
        ).select_related('product', 'created_by')
