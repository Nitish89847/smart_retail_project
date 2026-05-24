 ---- Backend ----
cd backend

python -m venv venv
call venv\Scripts\activate.bat

pip install -r requirements.txt

copy .env.example .env

python manage.py makemigrations authentication inventory orders analytics ml_engine
python manage.py migrate
python manage.py seed_data

cd ..

---- Frontend ----
cd frontend

copy .env.example .env
npm install

cd ..


@REM Backend
cd backend
venv\Scripts\activate
python manage.py runserver

@REM Frontend
cd frontend
npm run dev
Admin Demo page Login: admin / admin123
