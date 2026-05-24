"""
Orders models — Order and Sale are tied to the user who created them.
"""
from django.db import models
from django.contrib.auth.models import User
from apps.inventory.models import Product


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('confirmed', 'Confirmed'),
        ('shipped', 'Shipped'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled'),
    ]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_orders')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def net_amount(self):
        return self.total_amount - self.discount

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    class Meta:
        db_table = 'order_items'


class Sale(models.Model):
    """
    Daily sales aggregate per product per user — the ML training data source.
    owner mirrors the product's owner for fast filtering.
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sales')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sales')
    date = models.DateField(db_index=True)
    quantity_sold = models.IntegerField(default=0)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'sales'
        unique_together = ['owner', 'product', 'date']
        ordering = ['-date']
