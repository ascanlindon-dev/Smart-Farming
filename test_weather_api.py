"""Check the same weather endpoint used by the app; no credentials in this script."""
import json
import requests


def main():
    response = requests.get(
        'http://127.0.0.1:8000/api/weather/',
        params={'q': 'Victoria, Oriental Mindoro, Philippines', 'days': 5},
        timeout=25,
    )
    response.raise_for_status()
    data = response.json()
    print(json.dumps({key: data.get(key) for key in ('ok', 'source', 'stale', 'fetched_at', 'current')}, indent=2))


if __name__ == '__main__':
    main()
