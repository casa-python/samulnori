@echo off
echo Starting SAMULNORI Backend...

cd /d "%~dp0backend"

REM Python 가상환경 확인 및 생성
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM 가상환경 활성화
call venv\Scripts\activate

REM 의존성 설치
echo Installing dependencies...
pip install -r requirements.txt

REM 서버 실행
echo Starting server...
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause 