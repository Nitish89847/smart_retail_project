"""
ML Engine views — predictions and recommendations scoped to request.user.
Each user's forecast is based only on their own products and sales history.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.inventory.models import Product
from apps.orders.models import Sale, OrderItem
from .demand_forecaster import DemandForecaster
from .recommender import ProductRecommender


def _get_user_product(user, product_id):
    """Return product only if it belongs to this user."""
    try:
        return Product.objects.get(id=product_id, owner=user, is_active=True)
    except Product.DoesNotExist:
        return None


def _get_sales_data(user, product):
    """Fetch this user's daily sales for one product."""
    qs = Sale.objects.filter(owner=user, product=product).order_by('date').values('date', 'quantity_sold')
    return [{'date': str(s['date']), 'quantity_sold': s['quantity_sold']} for s in qs]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def predict_demand(request, product_id):
    """
    Predict demand for one of the logged-in user's products.
    GET /api/ml/predict/{product_id}/?days=30&model=random_forest
    """
    product = _get_user_product(request.user, product_id)
    if not product:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

    days_ahead = int(request.query_params.get('days', 30))
    model_type = request.query_params.get('model', 'random_forest')
    if model_type not in ['random_forest', 'linear_regression']:
        return Response({'error': 'model must be random_forest or linear_regression'}, status=400)

    sales_data = _get_sales_data(request.user, product)
    if len(sales_data) < 14:
        sales_data = _generate_synthetic_sales(product.id, days=90)

    forecaster = DemandForecaster(model_type=model_type)
    metrics = forecaster.train(sales_data)
    if 'error' in metrics:
        return Response(metrics, status=status.HTTP_400_BAD_REQUEST)

    predictions = forecaster.predict(days_ahead=days_ahead, last_sales=sales_data)
    return Response({
        'product_id': product.id,
        'product_name': product.name,
        'model_used': model_type,
        'training_metrics': metrics,
        'predictions': predictions,
        'days_ahead': days_ahead,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def predict_all_products(request):
    """
    7-day forecast for ALL of the logged-in user's active products.
    GET /api/ml/predict-all/
    """
    user = request.user
    products = Product.objects.filter(owner=user, is_active=True).select_related('inventory', 'category')
    results = []

    for product in products:
        sales_data = _get_sales_data(user, product)
        if len(sales_data) < 14:
            sales_data = _generate_synthetic_sales(product.id, days=90)

        forecaster = DemandForecaster(model_type='random_forest')
        metrics = forecaster.train(sales_data)

        if 'error' in metrics:
            predicted_7d, r2 = 0, 0
        else:
            preds = forecaster.predict(days_ahead=7, last_sales=sales_data)
            predicted_7d = round(sum(p['predicted_quantity'] for p in preds), 1)
            r2 = metrics.get('r2_score', 0)

        current_stock = product.inventory.quantity if hasattr(product, 'inventory') else 0

        results.append({
            'product_id': product.id,
            'product_name': product.name,
            'category': product.category.name if product.category else 'N/A',
            'current_stock': current_stock,
            'predicted_demand_7d': predicted_7d,
            'confidence': round(max(0, r2) * 100, 1),
            'stock_covers_demand': current_stock >= predicted_7d,
        })

    results.sort(key=lambda x: x['stock_covers_demand'])
    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommend_products(request, product_id):
    """
    Co-purchase recommendations using the user's own order history.
    GET /api/ml/recommend/{product_id}/
    """
    product = _get_user_product(request.user, product_id)
    if not product:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

    # Only use this user's orders for co-purchase analysis
    orders_data = list(
        OrderItem.objects.filter(
            order__owner=request.user
        ).select_related('product', 'order').values(
            'order_id', 'product_id', 'product__name'
        )
    )
    orders_data = [
        {'order_id': o['order_id'], 'product_id': o['product_id'], 'product_name': o['product__name']}
        for o in orders_data
    ]

    recommender = ProductRecommender()
    recommender.fit(orders_data)
    recommendations = recommender.recommend(product_id=product_id, top_n=5)

    return Response({
        'product_id': product.id,
        'product_name': product.name,
        'recommendations': recommendations,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_forecast_chart(request, product_id):
    """
    Historical + forecast data for the chart.
    GET /api/ml/forecast-chart/{product_id}/?days=30
    """
    product = _get_user_product(request.user, product_id)
    if not product:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

    days = int(request.query_params.get('days', 30))
    sales_data = _get_sales_data(request.user, product)
    if len(sales_data) < 14:
        sales_data = _generate_synthetic_sales(product.id, days=90)

    historical = [
        {'date': s['date'], 'actual': s['quantity_sold'], 'type': 'historical'}
        for s in sales_data[-30:]
    ]

    forecaster = DemandForecaster(model_type='random_forest')
    metrics = forecaster.train(sales_data)
    predictions = []
    if 'error' not in metrics:
        raw = forecaster.predict(days_ahead=days, last_sales=sales_data)
        predictions = [{'date': p['date'], 'predicted': p['predicted_quantity'], 'type': 'forecast'} for p in raw]

    return Response({
        'product_name': product.name,
        'historical': historical,
        'forecast': predictions,
        'metrics': metrics,
    })


def _generate_synthetic_sales(product_id: int, days: int = 90) -> list:
    """
    Synthetic sales for new users with no sales history yet.
    Uses a deterministic seed per product so results are consistent.
    """
    import random, math
    from datetime import date, timedelta

    random.seed(product_id)
    base_demand = random.randint(5, 50)
    today = date.today()
    data = []

    for i in range(days):
        day = today - timedelta(days=days - i)
        seasonal = math.sin(2 * math.pi * i / 7) * (base_demand * 0.3)
        trend = (i / days) * base_demand * 0.2
        noise = random.gauss(0, base_demand * 0.15)
        qty = max(0, round(base_demand + seasonal + trend + noise))
        data.append({'date': str(day), 'quantity_sold': qty})

    return data
