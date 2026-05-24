"""
Analytics models - stores precomputed analytics and ML prediction results
"""
from django.db import models
from apps.inventory.models import Product


class DemandPrediction(models.Model):
    """Stores ML model predictions for product demand"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='predictions')
    predicted_date = models.DateField()
    predicted_quantity = models.FloatField()
    confidence_score = models.FloatField(default=0.0)   # R² score from model
    model_used = models.CharField(max_length=50, default='random_forest')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name} - {self.predicted_date} - {self.predicted_quantity}"

    class Meta:
        db_table = 'demand_predictions'
        ordering = ['predicted_date']


class RestockSuggestion(models.Model):
    """AI-generated restocking recommendations"""
    STATUS_CHOICES = [('pending', 'Pending'), ('actioned', 'Actioned'), ('dismissed', 'Dismissed')]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='restock_suggestions')
    suggested_quantity = models.IntegerField()
    reason = models.TextField()
    urgency = models.CharField(max_length=20, choices=[
        ('critical', 'Critical'), ('high', 'High'), ('medium', 'Medium'), ('low', 'Low')
    ], default='medium')
    estimated_days_to_stockout = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Restock {self.product.name} - {self.urgency}"

    class Meta:
        db_table = 'restock_suggestions'
        ordering = ['-created_at']
