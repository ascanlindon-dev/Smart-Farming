FROM node:22-bookworm-slim AS frontend
WORKDIR /frontend
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
# Public OAuth client ID only. API requests remain on the same origin.
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=backend.production \
    DJANGO_DEBUG=false \
    OMP_NUM_THREADS=2 \
    TF_NUM_INTRAOP_THREADS=2 \
    TF_NUM_INTEROP_THREADS=2
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements*.txt ./backend/
# Use CPU wheels so the Railway image does not include NVIDIA CUDA libraries.
RUN pip install --no-cache-dir torch==2.13.0 torchvision==0.28.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r backend/requirements-hosting.txt
COPY backend ./backend
COPY --from=frontend /frontend/build ./build
RUN python backend/scripts/setup_rambutan_guard.py
# Build static assets without production credentials or a database connection.
RUN DJANGO_SETTINGS_MODULE=backend.build_settings python backend/manage.py collectstatic --noinput
CMD ["sh", "backend/scripts/start_railway.sh"]
