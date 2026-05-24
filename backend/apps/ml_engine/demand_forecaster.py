"""
demand_forecaster.py
--------------------
Core ML module for demand forecasting.

Uses two models:
  1. Linear Regression  - simple, interpretable baseline
  2. Random Forest      - more accurate ensemble model

Features engineered from sales history:
  - day_of_week, month, week_of_year (time features)
  - lag_7, lag_14, lag_30 (past sales as predictors)
  - rolling_mean_7 (7-day moving average)
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')


class DemandForecaster:
    """
    Trains and runs demand forecasting models on product sales data.
    Can use LinearRegression or RandomForestRegressor.
    """

    def __init__(self, model_type='random_forest'):
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_columns = [
            'day_of_week', 'month', 'week_of_year',
            'lag_7', 'lag_14', 'lag_30', 'rolling_mean_7'
        ]

    def _build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Feature engineering: extract time-based and lag features from daily sales.
        Input df must have columns: ['date', 'quantity_sold']
        """
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        # Fill missing dates with 0
        date_range = pd.date_range(df['date'].min(), df['date'].max(), freq='D')
        df = df.set_index('date').reindex(date_range, fill_value=0).reset_index()
        df.columns = ['date', 'quantity_sold']

        # Time-based features
        df['day_of_week'] = df['date'].dt.dayofweek        # 0=Monday
        df['month'] = df['date'].dt.month
        df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)

        # Lag features (past sales are strong predictors of future sales)
        df['lag_7'] = df['quantity_sold'].shift(7).fillna(0)
        df['lag_14'] = df['quantity_sold'].shift(14).fillna(0)
        df['lag_30'] = df['quantity_sold'].shift(30).fillna(0)

        # Rolling average (smooths out noise)
        df['rolling_mean_7'] = df['quantity_sold'].shift(1).rolling(window=7, min_periods=1).mean().fillna(0)

        return df

    def train(self, sales_data: list) -> dict:
        """
        Train the forecasting model.

        Args:
            sales_data: list of dicts with 'date' and 'quantity_sold'

        Returns:
            dict with training metrics (MAE, R2 score)
        """
        if len(sales_data) < 14:
            return {'error': 'Need at least 14 days of sales data to train'}

        df = pd.DataFrame(sales_data)
        df = self._build_features(df)

        # Drop rows with NaN (early rows lacking lag data)
        df = df.dropna(subset=self.feature_columns)

        X = df[self.feature_columns].values
        y = df['quantity_sold'].values

        if len(X) < 10:
            return {'error': 'Insufficient data after feature engineering'}

        # Train/test split - keep time order (no shuffle)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        # Scale features (important for Linear Regression)
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Build model
        if self.model_type == 'linear_regression':
            self.model = LinearRegression()
        else:
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42,
                n_jobs=-1
            )

        self.model.fit(X_train_scaled, y_train)
        self.is_trained = True

        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        y_pred = np.clip(y_pred, 0, None)  # No negative predictions

        mae = mean_absolute_error(y_test, y_pred) if len(y_test) > 0 else 0
        r2 = r2_score(y_test, y_pred) if len(y_test) > 1 else 0

        return {
            'model_type': self.model_type,
            'training_samples': len(X_train),
            'mae': round(float(mae), 3),
            'r2_score': round(float(r2), 3),
            'status': 'trained'
        }

    def predict(self, days_ahead: int = 30, last_sales: list = None) -> list:
        """
        Predict demand for the next N days.

        Args:
            days_ahead: number of future days to predict
            last_sales: recent sales data for lag features

        Returns:
            list of {'date': str, 'predicted_quantity': float}
        """
        if not self.is_trained:
            return []

        predictions = []
        today = date.today()

        # Build a synthetic recent history for lag features
        if last_sales:
            recent_df = pd.DataFrame(last_sales)
            recent_df['date'] = pd.to_datetime(recent_df['date'])
        else:
            recent_df = pd.DataFrame({'date': [], 'quantity_sold': []})

        for i in range(days_ahead):
            future_date = today + timedelta(days=i + 1)

            # Get lag values from recent sales
            lag_7 = self._get_lag_value(recent_df, future_date, 7)
            lag_14 = self._get_lag_value(recent_df, future_date, 14)
            lag_30 = self._get_lag_value(recent_df, future_date, 30)
            rolling_7 = self._get_rolling_mean(recent_df, future_date, 7)

            features = np.array([[
                future_date.weekday(),
                future_date.month,
                future_date.isocalendar()[1],
                lag_7, lag_14, lag_30, rolling_7
            ]])

            features_scaled = self.scaler.transform(features)
            pred = self.model.predict(features_scaled)[0]
            pred = max(0, round(float(pred), 2))

            predictions.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_quantity': pred
            })

        return predictions

    def _get_lag_value(self, df, target_date, lag_days):
        """Get sales quantity from `lag_days` before target_date"""
        lag_date = pd.Timestamp(target_date - timedelta(days=lag_days))
        row = df[df['date'] == lag_date]
        return float(row['quantity_sold'].values[0]) if not row.empty else 0.0

    def _get_rolling_mean(self, df, target_date, window):
        """Calculate rolling mean of last `window` days before target_date"""
        end = pd.Timestamp(target_date - timedelta(days=1))
        start = pd.Timestamp(target_date - timedelta(days=window))
        subset = df[(df['date'] >= start) & (df['date'] <= end)]
        return float(subset['quantity_sold'].mean()) if not subset.empty else 0.0
