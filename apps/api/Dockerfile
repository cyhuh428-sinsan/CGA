FROM python:3.12-slim

WORKDIR /workspace

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/workspace/apps/api

ARG AIDOT_GPU=false
ARG AIDOT_TORCH_INDEX_URL=

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && if [ "$AIDOT_GPU" = "true" ]; then \
        test -n "$AIDOT_TORCH_INDEX_URL"; \
        pip install --no-cache-dir --index-url "$AIDOT_TORCH_INDEX_URL" torch; \
    fi

ENV PYTHONDONTWRITEBYTECODE=1

COPY apps/api /workspace/apps/api
RUN find /workspace/apps/api -type d -name '__pycache__' -prune -exec rm -rf {} + \
    && find /workspace/apps/api -type f -name '*.py[co]' -delete

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8000"]