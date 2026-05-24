"""
Orders serializers — owner is set by the view, never exposed.
"""
from rest_framework import serializers
from .models import Order, OrderItem, Sale
from apps.inventory.models import Product
import random, string


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    net_amount = serializers.ReadOnlyField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'order_number', 'customer_name', 'customer_email',
                  'status', 'total_amount', 'discount', 'net_amount', 'notes',
                  'items', 'created_by_username', 'created_at', 'updated_at']
        read_only_fields = ['order_number', 'total_amount', 'created_by', 'owner']


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CreateOrderSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=200)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    items = OrderItemCreateSerializer(many=True, min_length=1)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def _gen_order_number(self):
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        return f"ORD-{suffix}"

    def create(self, validated_data):
        from datetime import date
        items_data = validated_data.pop('items')
        user = self.context['request'].user

        # Validate products belong to this user and have stock
        order_items = []
        total = 0
        for item in items_data:
            try:
                product = Product.objects.get(id=item['product_id'], owner=user, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError(
                    f"Product {item['product_id']} not found in your inventory."
                )
            inv = product.inventory
            if inv.quantity < item['quantity']:
                raise serializers.ValidationError(
                    f"Insufficient stock for {product.name}. Available: {inv.quantity}"
                )
            order_items.append((product, item['quantity'], product.price))
            total += product.price * item['quantity']

        order = Order.objects.create(
            owner=user,
            order_number=self._gen_order_number(),
            customer_name=validated_data['customer_name'],
            customer_email=validated_data.get('customer_email', ''),
            discount=validated_data.get('discount', 0),
            notes=validated_data.get('notes', ''),
            total_amount=total,
            created_by=user,
        )

        today = date.today()
        for product, qty, price in order_items:
            OrderItem.objects.create(
                order=order, product=product, quantity=qty, unit_price=price
            )
            # Deduct stock
            inv = product.inventory
            inv.quantity -= qty
            inv.save()

            # Update daily sales aggregate (scoped to owner)
            sale, _ = Sale.objects.get_or_create(
                owner=user, product=product, date=today,
                defaults={'quantity_sold': 0, 'revenue': 0}
            )
            sale.quantity_sold += qty
            sale.revenue += price * qty
            sale.save()

        return order


class SaleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'product', 'product_name', 'date', 'quantity_sold', 'revenue']
