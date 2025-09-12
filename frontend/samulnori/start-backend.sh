#!/bin/bash

echo "Starting SAMULNORI Backend..."

# 스크립트가 있는 디렉토리로 이동
cd "$(dirname "$0")/backend"

# Python 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# 가상환경 활성화
source venv/bin/activate

# 의존성 설치
echo "Installing dependencies..."
pip install -r requirements.txt

# 서버 실행
echo "Starting server..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 