import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
# One process avoids loading TensorFlow and the 577 MiB verifier per worker.
workers = 1
worker_class = 'gthread'
threads = 2
timeout = 180
graceful_timeout = 30
accesslog = '-'
errorlog = '-'
capture_output = True
# Django handles Railway's trusted HTTPS proxy header.
forwarded_allow_ips = '*'
