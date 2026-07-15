FROM python:3.11-slim

WORKDIR /app

# Install system deps for aiohttp and ccxt
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Create data directory
RUN mkdir -p /app/data /app/logs

EXPOSE 9121

CMD ["uvicorn", "workspace.main:app", "--host", "0.0.0.0", "--port", "9121"]
