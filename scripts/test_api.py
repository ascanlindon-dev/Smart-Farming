import urllib.request, urllib.error, json

BASE = 'http://localhost:8000'

# external HTTP (including API namespace)
for path in ['/api/', '/api/ping', '/api/sensors', '/', '/ping', '/users']:
    try:
        with urllib.request.urlopen(BASE + path) as r:
            print('EXTERNAL GET', path, '->', r.status, r.read().decode())
    except urllib.error.HTTPError as he:
        print('EXTERNAL GET', path, '-> HTTPError', he.code, he.read().decode())
    except Exception as e:
        print('EXTERNAL GET', path, '-> ERROR', e)
