"""
recommender.py
--------------
Product recommendation system using co-purchase frequency.

Logic:
  - Analyze which products are frequently bought together (market basket)
  - For a given product, recommend the top N most co-purchased products
  - Simple but effective for an interview-ready implementation
"""

from collections import defaultdict
from itertools import combinations


class ProductRecommender:
    """
    Co-purchase based product recommender.
    Similar in spirit to Apriori but without the overhead.
    """

    def __init__(self):
        self.co_purchase_matrix = defaultdict(lambda: defaultdict(int))
        self.product_names = {}
        self.is_fitted = False

    def fit(self, orders_data: list):
        """
        Build the co-purchase matrix from historical orders.

        Args:
            orders_data: list of dicts, each with:
                {
                    'order_id': int,
                    'product_id': int,
                    'product_name': str
                }
        """
        # Group products by order
        orders_dict = defaultdict(list)
        for item in orders_data:
            orders_dict[item['order_id']].append(item['product_id'])
            self.product_names[item['product_id']] = item['product_name']

        # Count co-occurrences
        for order_id, products in orders_dict.items():
            products = list(set(products))  # Deduplicate within order
            if len(products) > 1:
                for p1, p2 in combinations(products, 2):
                    self.co_purchase_matrix[p1][p2] += 1
                    self.co_purchase_matrix[p2][p1] += 1

        self.is_fitted = True

    def recommend(self, product_id: int, top_n: int = 5) -> list:
        """
        Get top N recommended products for a given product.

        Returns:
            list of {'product_id', 'product_name', 'score'} dicts
        """
        if not self.is_fitted or product_id not in self.co_purchase_matrix:
            return []

        co_purchases = self.co_purchase_matrix[product_id]
        sorted_products = sorted(co_purchases.items(), key=lambda x: x[1], reverse=True)

        return [
            {
                'product_id': pid,
                'product_name': self.product_names.get(pid, f'Product {pid}'),
                'score': count,
            }
            for pid, count in sorted_products[:top_n]
        ]
