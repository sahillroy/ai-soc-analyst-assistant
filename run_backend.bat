@echo off
echo Starting SOC Analyst Backend (Activating Virtual Environment)...
call .venv\Scripts\activate.bat
uvicorn backend.api.main:app --port 8000 --reload
