#!/bin/sh
set -eu

cd /workspace/apps/api

alembic upgrade head
python -m app.db.bootstrap

exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
