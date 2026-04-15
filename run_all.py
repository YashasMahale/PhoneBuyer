import subprocess
import sys
import os
import time
import signal


# Find project root (the folder containing this script)
PROJECT_ROOT = os.path.dirname(os.path.realpath(__file__))
SCRAPER = os.path.join(PROJECT_ROOT, 'scraper', 'scraper.py')
BACKEND = os.path.join(PROJECT_ROOT, 'backend', 'main.py')
DATA_JSON = os.path.join(PROJECT_ROOT, 'data', 'phones.json')

# 1. Scrape and generate dataset
print('--- Running GSMArena scraper...')
subprocess.run([sys.executable, SCRAPER], check=True, cwd=PROJECT_ROOT)
assert os.path.exists(DATA_JSON), f'phones.json not generated at {DATA_JSON}!'
print('--- Scraping complete.')

# 2. Start backend server
print('--- Starting backend server...')
backend_proc = subprocess.Popen([
    sys.executable, '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000'
], cwd=PROJECT_ROOT)

# 3. Wait for backend to be ready
for _ in range(30):
    try:
        import requests
        r = requests.get('http://127.0.0.1:8000/api/phones', timeout=2)
        if r.status_code == 200:
            print('--- Backend is live.')
            break
    except Exception:
        time.sleep(1)
else:
    backend_proc.terminate()
    raise RuntimeError('Backend did not start in time.')

# 4. Show sample output
print('--- Sample output from /api/phones:')
try:
    r = requests.get('http://127.0.0.1:8000/api/phones', timeout=5)
    phones = r.json()
    for phone in phones[:5]:
        print(phone)
    print(f'... ({len(phones)} phones total)')
finally:
    print('--- Shutting down backend.')
    backend_proc.send_signal(signal.SIGINT)
    backend_proc.wait()
