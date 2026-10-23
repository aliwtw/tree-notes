FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install Docker CLI so backend container can exec into Ollama container
RUN apt-get update && apt-get install docker-cli -y

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY backend/ ./backend

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI with uvicorn.
# --reload watches the ./backend bind mount from docker-compose, so code changes
# take effect without rebuilding. --proxy-headers makes uvicorn trust the
# X-Forwarded-* headers nginx sets, so redirects and client IPs resolve to the
# browser's origin rather than the internal container address.
CMD ["uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--reload", "--reload-dir", "/app/backend", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
