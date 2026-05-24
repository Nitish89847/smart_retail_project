"""
Management command: python manage.py seed_data
Seeds demo data ONLY for the admin account.
New users start with a completely empty store.
"""
import random, math
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.authentication.models import UserProfile
from apps.inventory.models import Category, Product, Inventory
from apps.orders.models import Order, OrderItem, Sale

CATEGORIES = [
    ('Electronics', 'Gadgets and devices'),
    ('Clothing', 'Apparel and fashion'),
    ('Food & Beverage', 'Groceries and drinks'),
    ('Home & Kitchen', 'Household items'),
    ('Sports & Fitness', 'Sports equipment'),
    ('Books & Stationery', 'Books and office supplies'),
]

PRODUCTS = [
    # (name, sku, category, price, cost, base_demand)
    ('Wireless Earbuds Pro', 'ELEC-001', 'Electronics', 79.99, 35.00, 15),
    ('USB-C Charging Cable', 'ELEC-002', 'Electronics', 12.99, 4.00, 40),
    ('Bluetooth Speaker', 'ELEC-003', 'Electronics', 49.99, 22.00, 12),
    ('Phone Stand Holder', 'ELEC-004', 'Electronics', 15.99, 5.50, 25),
    ('Laptop Sleeve 15"', 'ELEC-005', 'Electronics', 24.99, 9.00, 18),
    ("Men's Casual T-Shirt", 'CLO-001', 'Clothing', 19.99, 7.00, 30),
    ("Women's Yoga Pants", 'CLO-002', 'Clothing', 34.99, 12.00, 22),
    ('Denim Jacket', 'CLO-003', 'Clothing', 59.99, 25.00, 8),
    ('Running Shoes', 'CLO-004', 'Clothing', 89.99, 38.00, 10),
    ('Winter Scarf', 'CLO-005', 'Clothing', 14.99, 5.00, 14),
    ('Organic Green Tea', 'FOO-001', 'Food & Beverage', 8.99, 3.00, 50),
    ('Protein Bar Pack', 'FOO-002', 'Food & Beverage', 24.99, 10.00, 35),
    ('Instant Coffee 200g', 'FOO-003', 'Food & Beverage', 11.99, 5.00, 45),
    ('Mineral Water 1L', 'FOO-004', 'Food & Beverage', 1.99, 0.50, 80),
    ('Mixed Nuts 500g', 'FOO-005', 'Food & Beverage', 13.99, 6.00, 28),
    ('Non-stick Frying Pan', 'HOM-001', 'Home & Kitchen', 39.99, 16.00, 11),
    ('Coffee Maker', 'HOM-002', 'Home & Kitchen', 69.99, 30.00, 6),
    ('Cutting Board Set', 'HOM-003', 'Home & Kitchen', 22.99, 9.00, 14),
    ('Storage Containers 5pc', 'HOM-004', 'Home & Kitchen', 17.99, 7.00, 20),
    ('Yoga Mat', 'SPO-001', 'Sports & Fitness', 29.99, 12.00, 16),
    ('Resistance Bands Set', 'SPO-002', 'Sports & Fitness', 19.99, 7.00, 24),
    ('Water Bottle 1L', 'SPO-003', 'Sports & Fitness', 14.99, 5.50, 32),
    ('Jump Rope', 'SPO-004', 'Sports & Fitness', 9.99, 3.50, 20),
    ('Notebook A5 Ruled', 'BOO-001', 'Books & Stationery', 4.99, 1.50, 60),
    ('Ball Pen Set 12pc', 'BOO-002', 'Books & Stationery', 7.99, 2.50, 55),
    ('Sticky Notes Pack', 'BOO-003', 'Books & Stationery', 3.99, 1.20, 48),
    ('Desk Organizer', 'BOO-004', 'Books & Stationery', 16.99, 6.00, 15),
    ('Highlighter Set', 'BOO-005', 'Books & Stationery', 5.99, 2.00, 38),
]


class Command(BaseCommand):
    help = 'Seeds demo data for the admin account ONLY. Other users start empty.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=90)

    def handle(self, *args, **options):
        days = options['days']
        self.stdout.write(self.style.SUCCESS('🌱 Seeding demo data for admin account...'))

        # 1. Create admin user
        admin = self._create_admin()

        # 2. Seed categories + products + inventory ONLY for admin
        cat_map = self._create_categories(admin)
        product_map = self._create_products(admin, cat_map)

        # 3. Generate sales history ONLY for admin
        self._generate_sales(admin, product_map, days)

        self.stdout.write(self.style.SUCCESS(
            f'✅ Done! Admin demo store: {len(product_map)} products, {days} days of sales.\n'
            f'   New users who register will start with an empty store.'
        ))

    def _create_admin(self):
        if not User.objects.filter(username='admin').exists():
            admin = User.objects.create_superuser('admin', 'admin@smartretail.com', 'admin123',
                                                   first_name='Admin', last_name='Demo')
            UserProfile.objects.get_or_create(
                user=admin, defaults={'role': 'admin', 'store_name': 'SmartRetail Demo Store'}
            )
            self.stdout.write('  Created admin user (admin / admin123)')
        else:
            admin = User.objects.get(username='admin')
            self.stdout.write('  Admin user already exists — refreshing demo data')
        return admin

    def _create_categories(self, owner):
        cat_map = {}
        for name, desc in CATEGORIES:
            cat, _ = Category.objects.get_or_create(
                owner=owner, name=name, defaults={'description': desc}
            )
            cat_map[name] = cat
        self.stdout.write(f'  Created {len(cat_map)} categories for admin')
        return cat_map

    def _create_products(self, owner, cat_map):
        product_map = {}
        for name, sku, cat_name, price, cost, base_demand in PRODUCTS:
            if Product.objects.filter(owner=owner, sku=sku).exists():
                product = Product.objects.get(owner=owner, sku=sku)
            else:
                product = Product.objects.create(
                    owner=owner, name=name, sku=sku,
                    category=cat_map.get(cat_name),
                    price=price, cost_price=cost
                )
                random.seed(hash(sku))
                qty = random.randint(10, 150)
                Inventory.objects.get_or_create(
                    product=product,
                    defaults={'quantity': qty, 'reorder_point': 20, 'reorder_quantity': 60}
                )
            product_map[sku] = (product, base_demand)
        self.stdout.write(f'  Created {len(product_map)} products for admin')
        return product_map

    def _generate_sales(self, owner, product_map, days):
        today = date.today()
        sale_count = 0

        for sku, (product, base_demand) in product_map.items():
            random.seed(hash(sku))
            for i in range(days):
                sale_date = today - timedelta(days=days - i)
                weekday_factor = 1.3 if sale_date.weekday() >= 5 else 1.0
                trend = 1 + (i / days) * 0.2
                noise = random.gauss(1, 0.2)
                quantity = max(0, round(base_demand * weekday_factor * trend * noise))
                if quantity == 0:
                    continue
                revenue = round(quantity * float(product.price), 2)
                Sale.objects.update_or_create(
                    owner=owner, product=product, date=sale_date,
                    defaults={'quantity_sold': quantity, 'revenue': revenue}
                )
                sale_count += 1

        # Generate sample orders for admin
        customers = [
            ('Alice Johnson', 'alice@example.com'),
            ('Bob Smith', 'bob@example.com'),
            ('Carol White', 'carol@example.com'),
            ('David Brown', 'david@example.com'),
            ('Emma Davis', 'emma@example.com'),
        ]
        products_list = [p for p, _ in product_map.values()]
        for i in range(min(days, 30)):
            num_orders = random.randint(1, 4)
            for j in range(num_orders):
                customer = random.choice(customers)
                order = Order.objects.create(
                    owner=owner,
                    order_number=f'ORD-DEMO-{i:03d}{j:02d}',
                    customer_name=customer[0],
                    customer_email=customer[1],
                    status=random.choice(['delivered', 'delivered', 'confirmed', 'pending']),
                    created_by=owner,
                )
                total = 0
                chosen = random.sample(products_list, min(random.randint(1, 3), len(products_list)))
                for product in chosen:
                    qty = random.randint(1, 3)
                    OrderItem.objects.create(
                        order=order, product=product, quantity=qty, unit_price=product.price
                    )
                    total += qty * float(product.price)
                order.total_amount = total
                order.save()

        self.stdout.write(f'  Generated {sale_count} daily sales records for admin')
