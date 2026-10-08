FROM python:3.12-slim
WORKDIR /srv
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
RUN useradd --system ia && mkdir -p models data && chown ia models data
USER ia
ENV IA_MODELS_DIR=/srv/models IA_DATA_DIR=/srv/data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
