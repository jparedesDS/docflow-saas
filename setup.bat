@echo off
echo ===== DocFlow Industrial - Setup Windows =====

echo.
echo [1/5] Creando entorno virtual Python...
python -m venv docflow_env
call docflow_env\Scripts\activate.bat

echo.
echo [2/5] Instalando dependencias Python...
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo [3/5] Instalando dependencias frontend...
cd docflow\frontend
npm install
cd ..\..

echo.
echo [4/5] Clonando taste-skill (IA local)...
git clone https://github.com/Leonxlnx/taste-skill.git
cd taste-skill
pip install -r requirements.txt
cd ..

echo.
echo [5/5] Clonando email-best-practices (Resend)...
git clone https://github.com/resend/email-best-practices.git

echo.
echo ===== Setup completo =====
echo Backend:  cd docflow\backend ^& uvicorn main:app --reload
echo Frontend: cd docflow\frontend ^& npm start
echo.
pause
