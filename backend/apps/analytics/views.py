"""
Analytics views — every query is filtered by request.user.
Users only see their own revenue, products, and recommendations.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta, date

from apps.inventory.models import Product, Category
from apps.orders.models import Order, Sale


def user_products(user):
    """Helper: active products belonging to this user."""
    return Product.objects.filter(owner=user, is_active=True)


def user_sales(user):
    """Helper: sales belonging to this user."""
    return Sale.objects.filter(owner=user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    today = date.today()
    month_start = today.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    this_month_rev = user_sales(user).filter(
        date__gte=month_start
    ).aggregate(t=Sum('revenue'))['t'] or 0

    last_month_rev = user_sales(user).filter(
        date__gte=last_month_start, date__lt=month_start
    ).aggregate(t=Sum('revenue'))['t'] or 0

    rev_change = 0
    if last_month_rev > 0:
        rev_change = round(
            ((float(this_month_rev) - float(last_month_rev)) / float(last_month_rev)) * 100, 1
        )

    total_orders = Order.objects.filter(owner=user, created_at__date__gte=month_start).count()
    total_products = user_products(user).count()

    low_stock_count = sum(
        1 for p in user_products(user).select_related('inventory')
        if hasattr(p, 'inventory') and p.inventory.is_low_stock
    )

    top_products = user_sales(user).filter(date__gte=month_start).values(
        'product__name', 'product__id'
    ).annotate(
        total_sold=Sum('quantity_sold'),
        total_revenue=Sum('revenue')
    ).order_by('-total_sold')[:5]

    units_sold = user_sales(user).filter(
        date__gte=month_start
    ).aggregate(t=Sum('quantity_sold'))['t'] or 0

    return Response({
        'revenue': {
            'this_month': float(this_month_rev),
            'last_month': float(last_month_rev),
            'change_percent': rev_change,
        },
        'orders': {'this_month': total_orders},
        'inventory': {
            'total_products': total_products,
            'low_stock_alerts': low_stock_count,
        },
        'units_sold': units_sold,
        'top_products': list(top_products),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_revenue_trend(request):
    user = request.user
    monthly = user_sales(user).annotate(
        month=TruncMonth('date')
    ).values('month').annotate(
        revenue=Sum('revenue'),
        units=Sum('quantity_sold'),
    ).order_by('month')

    result = list(monthly)[-12:]
    return Response([{
        'month': item['month'].strftime('%b %Y') if item['month'] else '',
        'revenue': float(item['revenue'] or 0),
        'units': item['units'] or 0,
    } for item in result])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_trend_daily(request):
    user = request.user
    days = int(request.query_params.get('days', 30))
    since = date.today() - timedelta(days=days)

    daily = user_sales(user).filter(date__gte=since).values('date').annotate(
        revenue=Sum('revenue'),
        units=Sum('quantity_sold')
    ).order_by('date')

    return Response([{
        'date': item['date'].strftime('%Y-%m-%d'),
        'revenue': float(item['revenue'] or 0),
        'units': item['units'] or 0,
    } for item in daily])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_performance(request):
    user = request.user
    since = date.today() - timedelta(days=30)

    data = user_sales(user).filter(date__gte=since).values(
        'product__category__name', 'product__category__id'
    ).annotate(
        total_revenue=Sum('revenue'),
        total_units=Sum('quantity_sold')
    ).order_by('-total_revenue')

    return Response([{
        'category': item['product__category__name'] or 'Uncategorized',
        'revenue': float(item['total_revenue'] or 0),
        'units': item['total_units'] or 0,
    } for item in data])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_status_breakdown(request):
    user = request.user
    in_stock = low_stock = out_of_stock = 0

    for p in user_products(user).select_related('inventory'):
        if hasattr(p, 'inventory'):
            s = p.inventory.stock_status
            if s == 'in_stock': in_stock += 1
            elif s == 'low_stock': low_stock += 1
            else: out_of_stock += 1

    return Response([
        {'name': 'In Stock', 'value': in_stock, 'color': '#22c55e'},
        {'name': 'Low Stock', 'value': low_stock, 'color': '#f59e0b'},
        {'name': 'Out of Stock', 'value': out_of_stock, 'color': '#ef4444'},
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def restock_suggestions_view(request):
    user = request.user
    suggestions = []
    since = date.today() - timedelta(days=30)

    for product in user_products(user).select_related('inventory', 'category'):
        if not hasattr(product, 'inventory'):
            continue
        inv = product.inventory

        sales_data = user_sales(user).filter(
            product=product, date__gte=since
        ).aggregate(
            total_units=Sum('quantity_sold'),
            days_active=Count('date', distinct=True)
        )

        total_units = sales_data['total_units'] or 0
        days_active = sales_data['days_active'] or 1
        daily_velocity = total_units / days_active

        if daily_velocity == 0 and not inv.is_low_stock:
            continue

        days_to_stockout = (inv.quantity / daily_velocity) if daily_velocity > 0 else None

        if inv.quantity == 0:
            urgency = 'critical'
        elif days_to_stockout and days_to_stockout <= 3:
            urgency = 'critical'
        elif days_to_stockout and days_to_stockout <= 7:
            urgency = 'high'
        elif inv.is_low_stock:
            urgency = 'medium'
        else:
            continue

        suggested_qty = max(inv.reorder_quantity, int(daily_velocity * 30))

        reason = (
            "Product is completely out of stock." if inv.quantity == 0
            else f"Stock will run out in ~{round(days_to_stockout, 1)}d at current velocity." if days_to_stockout and days_to_stockout <= 7
            else f"Stock ({inv.quantity}) is below reorder point ({inv.reorder_point})."
        )

        suggestions.append({
            'product_id': product.id,
            'product_name': product.name,
            'sku': product.sku,
            'category': product.category.name if product.category else 'N/A',
            'current_stock': inv.quantity,
            'daily_velocity': round(daily_velocity, 2),
            'days_to_stockout': round(days_to_stockout, 1) if days_to_stockout else None,
            'suggested_quantity': suggested_qty,
            'urgency': urgency,
            'reason': reason,
        })

    urgency_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    suggestions.sort(key=lambda x: urgency_order.get(x['urgency'], 4))
    return Response(suggestions)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_products(request):
    user = request.user
    limit = int(request.query_params.get('limit', 10))
    days = int(request.query_params.get('days', 30))
    since = date.today() - timedelta(days=days)

    products = user_sales(user).filter(date__gte=since).values(
        'product__id', 'product__name', 'product__sku', 'product__category__name'
    ).annotate(
        total_revenue=Sum('revenue'),
        total_units=Sum('quantity_sold')
    ).order_by('-total_revenue')[:limit]

    return Response([{
        'id': p['product__id'],
        'name': p['product__name'],
        'sku': p['product__sku'],
        'category': p['product__category__name'],
        'revenue': float(p['total_revenue'] or 0),
        'units_sold': p['total_units'] or 0,
    } for p in products])
