# Designed and Implemented by: Girish Subramanya <girish.subramanya@daimlertruck.com>
# Date: 2025-12-23
# Version: 1

FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directory and declare volume
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 5005

CMD ["gunicorn", "-b", "0.0.0.0:5005", "app:app"]
