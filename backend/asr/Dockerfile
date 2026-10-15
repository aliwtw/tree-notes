FROM pytorch/pytorch:2.1.2-cuda11.8-cudnn8-runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Replace the old pip bundled with the PyTorch image.
# Using get-pip avoids relying on the broken pip to upgrade itself.
RUN curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py \
    && python /tmp/get-pip.py --force-reinstall "pip==25.2" \
    && rm /tmp/get-pip.py \
    && python -m pip --version

COPY backend/asr/requirements.txt .

RUN python -m pip install \
    --no-cache-dir \
    --index-url https://pypi.org/simple \
    -r requirements.txt

COPY backend/asr/ ./backend/asr/

CMD ["uvicorn", "backend.asr.main:app", "--host", "0.0.0.0", "--port", "8000"]