"""
Orders views — all querysets filtered by request.user (owner).
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta, date

from .models import Order, Sale
from .serializers import OrderSerializer, CreateOrderSerializer, SaleSerializer


class OrderViewSet(viewsets.ModelViewSet):
    """Orders — scoped to the logged-in user."""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['order_number', 'customer_name', 'customer_email']
    ordering = ['-created_at']

    def get_queryset(self):
        return Order.objects.filter(
            owner=self.request.user
        ).prefetch_related('items__product')

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateOrderSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            order = serializer.save()
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        valid = [c[0] for c in Order.STATUS_CHOICES]
        if new_status not in valid:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        order.save()
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'], url_path='recent')
    def recent_orders(self, request):
        since = timezone.now() - timedelta(days=7)
        orders = self.get_queryset().filter(created_at__gte=since)[:20]
        return Response(OrderSerializer(orders, many=True).data)


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    """Sales data — scoped to the logged-in user."""
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product']
    ordering = ['-date']

    def get_queryset(self):
        return Sale.objects.filter(owner=self.request.user).select_related('product')

    @action(detail=False, methods=['get'], url_path='summary')
    def sales_summary(self, request):
        days = int(request.query_params.get('days', 30))
        since = timezone.now().date() - timedelta(days=days)
        qs = self.get_queryset().filter(date__gte=since)

        summary = qs.aggregate(
            total_revenue=Sum('revenue'),
            total_units=Sum('quantity_sold'),
        )
        top_products = qs.values('product__name', 'product__id').annotate(
            total_sold=Sum('quantity_sold'),
            total_revenue=Sum('revenue')
        ).order_by('-total_sold')[:10]

        return Response({
            'period_days': days,
            'total_revenue': summary['total_revenue'] or 0,
            'total_units_sold': summary['total_units'] or 0,
            'top_products': list(top_products),
        })

    @action(detail=False, methods=['get'], url_path='monthly')
    def monthly_revenue(self, request):
        from django.db.models.functions import TruncMonth
        monthly = self.get_queryset().annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            revenue=Sum('revenue'), units=Sum('quantity_sold')
        ).order_by('-month')[:12]
        return Response(list(monthly))
