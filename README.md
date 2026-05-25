# smart_retail_project
A full-stack web application that helps retail stores manage inventory, analyze sales trends, forecast product demand using machine learning, and optimize restocking decisions.

- Built a full-stack AI-powered retail management system using **Django REST Framework** and **React (Vite)**, featuring JWT authentication, paginated REST APIs, and a responsive dashboard UI
- Implemented **demand forecasting** using **Scikit-learn's Random Forest Regressor** and **Linear Regression** with lag features, rolling averages, and seasonal signals; evaluated with MAE and R² metrics
- Designed a **normalized relational database** (7+ tables) with proper indexing and foreign key relationships for inventory, orders, and sales tracking
- Built an **AI restock recommendation engine** that calculates per-product daily sales velocity and estimates days-to-stockout to prioritize critical restocking actions
- Developed a **co-purchase product recommendation system** using market basket analysis to surface frequently bought-together products
- Created interactive analytics dashboards with **Recharts** displaying real-time KPIs, trend charts, and category performance breakdowns

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Recharts, Axios
| Backend | Django 4.2, Django REST Framework, Simple JWT
| Database | SQLite / MySQL
| ML/AI | Scikit-learn, Pandas, NumPy
| Auth | JWT (JSON Web Tokens)

