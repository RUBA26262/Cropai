FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

RUN addgroup --system cropai && adduser --system --ingroup cropai --home /app cropai
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
USER cropai
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers
