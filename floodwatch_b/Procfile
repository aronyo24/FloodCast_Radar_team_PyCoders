release: python manage.py migrate --noinput && python manage.py bootstrap_data
web: python manage.py restore_overlays && gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers ${WEB_CONCURRENCY:-2} --timeout 120 --log-file -
