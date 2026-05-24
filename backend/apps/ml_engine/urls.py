from django.urls import path
from . import views

urlpatterns = [
    path('predict/<int:product_id>/', views.predict_demand, name='predict-demand'),
    path('predict-all/', views.predict_all_products, name='predict-all'),
    path('recommend/<int:product_id>/', views.recommend_products, name='recommend'),
    path('forecast-chart/<int:product_id>/', views.sales_forecast_chart, name='forecast-chart'),
]
