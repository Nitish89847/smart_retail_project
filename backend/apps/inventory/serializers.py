"""
Inventory serializers — owner field is write_only (set by view, never exposed in response).
"""
from rest_framework import serializers
from .models import Category, Product, Inventory, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'product_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()


class InventorySerializer(serializers.ModelSerializer):
    stock_status = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = Inventory
        fields = ['id', 'quantity', 'reorder_point', 'reorder_quantity',
                  'location', 'last_restocked', 'stock_status', 'is_low_stock', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    inventory = InventorySerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    profit_margin = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'category', 'category_name', 'description',
                  'price', 'cost_price', 'profit_margin', 'is_active', 'inventory',
                  'created_at', 'updated_at']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value


class ProductCreateSerializer(serializers.ModelSerializer):
    """Used for POST /products/ — also auto-creates an Inventory row."""
    initial_quantity = serializers.IntegerField(write_only=True, default=0, min_value=0)
    reorder_point = serializers.IntegerField(write_only=True, default=10, min_value=0)

    class Meta:
        model = Product
        fields = ['name', 'sku', 'category', 'description', 'price',
                  'cost_price', 'initial_quantity', 'reorder_point']

    def validate_sku(self, value):
        return value.upper().strip()

    def create(self, validated_data):
        initial_quantity = validated_data.pop('initial_quantity', 0)
        reorder_point = validated_data.pop('reorder_point', 10)
        # owner is passed in by perform_create via save(owner=request.user)
        product = Product.objects.create(**validated_data)
        Inventory.objects.create(
            product=product,
            quantity=initial_quantity,
            reorder_point=reorder_point
        )
        return product


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = ['id', 'product', 'product_name', 'movement_type', 'quantity',
                  'reference', 'notes', 'created_by_username', 'created_at']
        read_only_fields = ['created_by']


class UpdateStockSerializer(serializers.Serializer):
    quantity = serializers.IntegerField()
    movement_type = serializers.ChoiceField(choices=['purchase', 'sale', 'adjustment', 'return'])
    notes = serializers.CharField(required=False, allow_blank=True)
