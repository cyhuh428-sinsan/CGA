FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/apps/vector-worker

ARG AIDOT_GPU=false
ARG AIDOT_TORCH_INDEX_URL=

COPY apps/vector-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$AIDOT_GPU" = "true" ]; then \
        test -n "$AIDOT_TORCH_INDEX_URL"; \
        pip install --no-cache-dir --index-url "$AIDOT_TORCH_INDEX_URL" torch; \
    fi

COPY apps/vector-worker ./
RUN find /workspace/apps/vector-worker -type d -name '__pycache__' -prune -exec rm -rf {} + \
    && find /workspace/apps/vector-worker -type f -name '*.py[co]' -delete

EXPOSE 8350

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8350"]