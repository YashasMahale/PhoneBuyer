from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from fastapi import Header
from sse_starlette.sse import EventSourceResponse
import httpx
from urllib.parse import urlparse, urljoin
import json
import os
import random
import asyncio
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity
from fastapi import Query
from fastapi.responses import JSONResponse

# Initialize FastAPI
app = FastAPI(title="Phone Buyer API")

# Setup CORS to allow React Frontend to connect natively
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Mock Dataset
# Simple Server-Sent Events (SSE) broadcaster for real-time updates
clients: List[asyncio.Queue] = []


# Generate a human-friendly 'about' summary for a phone from specs
def generate_about(phone: dict) -> str:
    brand = phone.get('brand', '')
    name = phone.get('name', '')
    parts = []
    if phone.get('ram'):
        parts.append(f"{phone['ram']}GB RAM")
    if phone.get('storage_gb'):
        parts.append(f"{phone['storage_gb']}GB storage")
    if phone.get('camera_mp'):
        parts.append(f"{phone['camera_mp']}MP camera")
    if phone.get('battery_mah'):
        parts.append(f"{phone['battery_mah']}mAh battery")
    if phone.get('charging_w'):
        parts.append(f"{phone['charging_w']}W charging")
    osinfo = phone.get('os')
    rel = phone.get('release_date')
    desc = f"{brand} {name}"
    if rel:
        desc += f" (launched {rel})"
    if parts:
        desc += ": " + ', '.join(parts) + '.'
    if osinfo:
        desc += f" Runs {osinfo}."
    return desc


# Load Mock Dataset from disk

def load_data():
    # Prefer /data/phones.json, fallback to CSV
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(os.path.join(base_dir, '..', 'data'))
    json_path = os.path.join(data_dir, 'phones.json')
    csv_path = os.path.join(data_dir, 'phones.csv')
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading phones.json: {e}")
    # fallback to CSV
    if os.path.exists(csv_path):
        import csv
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                return list(reader)
        except Exception as e:
            print(f"Error loading phones.csv: {e}")
    print("No phone dataset found. Please run the scraper.")
    return []



phone_data = load_data()

# Ensure every phone has an `about` field
for p in phone_data:
    if not p.get('about'):
        p['about'] = generate_about(p)


def save_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'dataset.json')
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(phone_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving data: {e}")


async def fetch_external_phones() -> list:
    """Fetch phones from an external JSON API defined by EXTERNAL_API_URL.

    The external API should return either a JSON list of phone objects or a JSON
    object with a list in one of the common fields: 'data', 'results', 'phones', 'items'.
    Pagination is handled when the API returns a 'next' field with a URL.
    """
    url = os.environ.get('EXTERNAL_API_URL')
    if not url:
        print('EXTERNAL_API_URL not set; skipping external sync')
        return []

    api_key = os.environ.get('EXTERNAL_API_KEY')
    headers = {}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    items = []
    next_url = url
    async with httpx.AsyncClient(timeout=30.0) as client:
        while next_url:
            try:
                resp = await client.get(next_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                print('Error fetching external phones:', e)
                break

            # find list inside payload
            chunk = []
            if isinstance(data, dict):
                if isinstance(data.get('data'), list):
                    chunk = data['data']
                elif isinstance(data.get('results'), list):
                    chunk = data['results']
                elif isinstance(data.get('phones'), list):
                    chunk = data['phones']
                elif isinstance(data.get('items'), list):
                    chunk = data['items']
                elif isinstance(data, list):
                    chunk = data
                elif any(k in data for k in ('id','brand','name')):
                    chunk = [data]
            elif isinstance(data, list):
                chunk = data

            items.extend(chunk)

            # pagination: prefer 'next' field
            next_url = None
            if isinstance(data, dict) and isinstance(data.get('next'), str) and data.get('next'):
                # make absolute if needed
                parsed = urlparse(data['next'])
                if parsed.scheme:
                    next_url = data['next']
                else:
                    next_url = urljoin(url, data['next'])

    return items


def normalize_raw(raw: dict) -> dict:
    def first(*keys):
        for k in keys:
            if k in raw and raw[k] not in (None, ''):
                return raw[k]
        return None

    def to_int(v):
        try:
            return int(float(v))
        except Exception:
            return None

    norm = {}
    norm['external_id'] = first('external_id', 'id', 'uid', 'slug', 'model_id')
    norm['brand'] = first('brand', 'manufacturer', 'maker')
    norm['name'] = first('name', 'model', 'title')
    norm['price'] = to_int(first('price', 'msrp', 'launch_price')) or 0
    norm['ram'] = to_int(first('ram', 'memory', 'ram_gb'))
    norm['camera_mp'] = to_int(first('camera_mp', 'camera', 'main_camera'))
    norm['battery_mah'] = to_int(first('battery_mah', 'battery'))
    norm['storage_gb'] = to_int(first('storage_gb', 'storage'))
    norm['display_inch'] = first('display_inch', 'screen_size')
    norm['charging_w'] = to_int(first('charging_w', 'charging'))
    norm['processor'] = first('processor', 'cpu')
    norm['os'] = first('os', 'operating_system')
    norm['release_date'] = first('release_date', 'launch_date')
    # keep full raw for any extra fields
    norm['_raw'] = raw
    # prefer existing description
    norm['about'] = first('about', 'description', 'summary')
    return norm


async def sync_external_source() -> dict:
    raw_items = await fetch_external_phones()
    if not raw_items:
        return {'added': 0, 'updated': 0}

    added = 0
    updated = 0
    changed_phones = []

    # build index by external_id and by brand+name
    by_external = {p.get('external_id'): p for p in phone_data if p.get('external_id')}
    by_name = { ( (p.get('brand') or '').strip().casefold(), (p.get('name') or '').strip().casefold() ): p for p in phone_data }

    max_id = max((p.get('id', 0) for p in phone_data), default=0)

    for raw in raw_items:
        norm = normalize_raw(raw)

        # skip phones released before 2015 if release_date exists
        rd = norm.get('release_date')
        if rd:
            try:
                year = int(str(rd).split('-')[0])
                if year < 2015:
                    continue
            except Exception:
                pass

        existing = None
        if norm.get('external_id') and norm['external_id'] in by_external:
            existing = by_external[norm['external_id']]
        else:
            key = ((norm.get('brand') or '').strip().casefold(), (norm.get('name') or '').strip().casefold())
            existing = by_name.get(key)

        if existing:
            # update selective fields
            updated_fields = False
            for k in ('price','ram','camera_mp','battery_mah','storage_gb','display_inch','charging_w','processor','os','release_date'):
                v = norm.get(k)
                if v is not None and existing.get(k) != v:
                    existing[k] = v
                    updated_fields = True
            # ensure external_id and about
            if norm.get('external_id') and existing.get('external_id') != norm.get('external_id'):
                existing['external_id'] = norm.get('external_id')
                updated_fields = True
            if norm.get('about') and existing.get('about') != norm.get('about'):
                existing['about'] = norm.get('about')
                updated_fields = True
            if updated_fields:
                updated += 1
                changed_phones.append(existing)
        else:
            # create new
            max_id += 1
            new = {
                'id': max_id,
                'external_id': norm.get('external_id'),
                'brand': norm.get('brand') or 'Unknown',
                'name': norm.get('name') or 'Unknown',
                'price': norm.get('price') or 0,
                'ram': norm.get('ram') or 0,
                'camera_mp': norm.get('camera_mp') or 0,
                'battery_mah': norm.get('battery_mah') or 0,
                'storage_gb': norm.get('storage_gb') or 0,
                'display_inch': norm.get('display_inch'),
                'charging_w': norm.get('charging_w') or 0,
                'processor': norm.get('processor') or '',
                'os': norm.get('os') or '',
                'release_date': norm.get('release_date'),
                'is_new': False,
            }
            if not norm.get('about'):
                new['about'] = generate_about(new)
            else:
                new['about'] = norm.get('about')

            phone_data.append(new)
            added += 1
            changed_phones.append(new)

    if added or updated:
        save_data()
        # broadcast a single update summarizing changes
        payload = {'type': 'phones_synced', 'added': added, 'updated': updated}
        for q in list(clients):
            try:
                await q.put(payload)
            except Exception:
                pass

    return {'added': added, 'updated': updated}


@app.post('/api/admin/sync')
async def admin_sync(x_admin_key: Optional[str] = Header(None)):
    admin_key = os.environ.get('ADMIN_KEY')
    if admin_key and x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail='Forbidden')

    summary = await sync_external_source()
    return summary


async def _background_sync_task(interval_minutes: int):
    while True:
        try:
            await sync_external_source()
        except Exception as e:
            print('Background sync failed:', e)
        await asyncio.sleep(max(60, interval_minutes * 60))


@app.on_event('startup')
async def start_periodic_sync():
    try:
        interval = int(os.environ.get('SYNC_INTERVAL_MINUTES', '0') or 0)
    except Exception:
        interval = 0
    if interval > 0:
        # run background sync task
        asyncio.create_task(_background_sync_task(interval))

# Data models
class UserRequirements(BaseModel):
    max_budget: int
    min_ram: int
    min_camera_mp: int
    min_battery_mah: int
    has_exchange: bool = False

class PhoneMatch(BaseModel):
    id: int
    brand: str
    name: str
    price: int
    ram: int
    camera_mp: int
    battery_mah: int
    match_score: float

# ML Ranking Engine
def rank_phones(requirements: UserRequirements):
    if not phone_data:
        return []
    
    # 1. Start by converting to a DataFrame
    df = pd.DataFrame(phone_data)
    
    # 2. Hard filter: Exclude phones far exceeding budget constraints.
    df_filtered = df[df['price'] <= requirements.max_budget].copy()
    
    if df_filtered.empty:
        return []

    # Features used for cosine similarity representation
    features = ['price', 'ram', 'camera_mp', 'battery_mah']
    
    # User's ideal vector
    ideal_user_vector = pd.DataFrame([{
        'price': requirements.max_budget,
        'ram': requirements.min_ram, 
        'camera_mp': requirements.min_camera_mp,
        'battery_mah': requirements.min_battery_mah
    }])
    
    # Append the ideal vector to the dataset to normalize together
    combined = pd.concat([df_filtered[features], ideal_user_vector], ignore_index=True)
    
    scaler = MinMaxScaler()
    normalized_data = scaler.fit_transform(combined)
    
    # Lower price is better, so invert the normalized price so that cheap and close to ideal are rewarded
    normalized_data[:, 0] = 1 - normalized_data[:, 0]
    
    # The last row is our ideal user vector
    user_vec_norm = normalized_data[-1].reshape(1, -1)
    
    # The rest are the actual phones
    phones_vec_norm = normalized_data[:-1]
    
    # Calculate Cosine Similarities
    similarities = cosine_similarity(user_vec_norm, phones_vec_norm)[0]
    
    # Multiply by 100 to get a score out of 100
    df_filtered['match_score'] = similarities * 100
    
    # Sort by match_score descending
    df_sorted = df_filtered.sort_values(by='match_score', ascending=False)
    
    # Build response format
    results = []
    for _, row in df_sorted.iterrows():
        results.append(PhoneMatch(
            id=row['id'],
            brand=row['brand'],
            name=row['name'],
            price=row['price'],
            ram=row['ram'],
            camera_mp=row['camera_mp'],
            battery_mah=row['battery_mah'],
            match_score=round(row['match_score'], 1)
        ))
    
    return results


@app.post("/api/recommend")
def recommend_phones(req: UserRequirements):
    return rank_phones(req)


# Filtering and ranking logic
@app.get("/api/phones")
def get_all_phones(
    price_min: int = Query(0, alias="price_min"),
    price_max: int = Query(500000, alias="price_max"),
    ram: Optional[int] = Query(None),
    battery: Optional[int] = Query(None),
    brand: Optional[str] = Query(None),
    camera: Optional[int] = Query(None),
    q: Optional[str] = Query(None)
):
    results = phone_data
    # Filtering
    results = [p for p in results if int(p.get('price', 0) or 0) >= price_min and int(p.get('price', 0) or 0) <= price_max]
    if ram is not None:
        results = [p for p in results if int(p.get('ram', 0) or 0) >= ram]
    if battery is not None:
        results = [p for p in results if int(p.get('battery', 0) or 0) >= battery]
    if brand is not None:
        results = [p for p in results if p.get('brand', '').lower() == brand.lower()]
    if camera is not None:
        results = [p for p in results if int(p.get('camera', p.get('camera_mp', 0)) or 0) >= camera]
    if q:
        results = [p for p in results if q.lower() in p.get('name', '').lower() or q.lower() in p.get('brand', '').lower()]
    return results


class SearchRequest(BaseModel):
    price_min: int = 0
    price_max: int = 500000
    ram: Optional[int] = None
    battery: Optional[int] = None
    brand: Optional[str] = None
    camera: Optional[int] = None
    q: Optional[str] = None

@app.post("/api/search")
def search_phones(req: SearchRequest):
    results = phone_data
    # Filtering
    results = [p for p in results if int(p.get('price', 0) or 0) >= req.price_min and int(p.get('price', 0) or 0) <= req.price_max]
    if req.ram is not None:
        results = [p for p in results if int(p.get('ram', 0) or 0) >= req.ram]
    if req.battery is not None:
        results = [p for p in results if int(p.get('battery', 0) or 0) >= req.battery]
    if req.brand is not None:
        results = [p for p in results if p.get('brand', '').lower() == req.brand.lower()]
    if req.camera is not None:
        results = [p for p in results if int(p.get('camera', p.get('camera_mp', 0)) or 0) >= req.camera]
    if req.q:
        results = [p for p in results if req.q.lower() in p.get('name', '').lower() or req.q.lower() in p.get('brand', '').lower()]
    # Ranking: simple score (RAM + battery + camera + price inverse)
    def score(p):
        ram = int(p.get('ram', 0) or 0)
        battery = int(p.get('battery', 0) or 0)
        camera = int(p.get('camera', p.get('camera_mp', 0)) or 0)
        price = int(p.get('price', 0) or 0)
        return ram * 2 + battery // 100 + camera * 3 - price // 10000
    results = sorted(results, key=score, reverse=True)
    # Add ranking_score field
    for idx, p in enumerate(results):
        p['ranking_score'] = score(p)
    return results

@app.get("/api/retailers/{phone_id}")
async def get_retailers(phone_id: int, has_exchange: bool = False):
    # Simulate a real-time scraping process with a 1.5 to 2.5 second delay
    await asyncio.sleep(random.uniform(1.5, 2.5))
    
    phone = next((p for p in phone_data if p['id'] == phone_id), None)
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    base_price = phone['price']
    
    # Generate mock competitive pricing. Amazon and Flipkart are typically cheaper.
    # Croma and Reliance are closer to MSRP.
    amazon_price = base_price - random.randint(1500, 4500)
    flipkart_price = base_price - random.randint(2000, 5000)
    croma_price = base_price - random.randint(0, 1500)
    reliance_price = base_price - random.randint(0, 500)
    
    prices_dict = {
        "Amazon India": amazon_price,
        "Flipkart": flipkart_price,
        "Croma": croma_price,
        "Reliance Digital": reliance_price
    }
    lowest_retailer = min(prices_dict, key=prices_dict.get)
    lowest_possible = prices_dict[lowest_retailer]
    
    bank_names = ["HDFC Bank Credit Card", "SBI Debit Card", "ICICI Amazon Pay Card", "Axis Bank Credit Card"]
    applied_bank = random.choice(bank_names)
    max_bank_discount = random.randint(4000, 8000)
    
    max_exchange_bonus = random.randint(5000, 15000) if has_exchange else 0
    absolute_lowest = lowest_possible - max_bank_discount - max_exchange_bonus
    
    if has_exchange:
        offer_details = f"Base price found on {lowest_retailer}. Includes max ₹{max_bank_discount} {applied_bank} Discount and ₹{max_exchange_bonus} Exchange Bonus."
    else:
        offer_details = f"Base price found on {lowest_retailer}. Includes max ₹{max_bank_discount} {applied_bank} Discount. (No exchange applied)"

    retailers = [
        {"name": "Absolute Lowest Price (All Offers)", "price": absolute_lowest, "stock": "Bank + Exchange", "url": "#", "is_special": True, "offer_details": offer_details},
        {"name": "Amazon India", "price": amazon_price, "stock": "In Stock", "url": f"https://www.amazon.in/s?k={phone['name'].replace(' ', '+')}", "is_special": False},
        {"name": "Flipkart", "price": flipkart_price, "stock": "In Stock", "url": f"https://www.flipkart.com/search?q={phone['name'].replace(' ', '+')}", "is_special": False},
        {"name": "Croma", "price": croma_price, "stock": "Few left", "url": f"https://www.croma.com/searchB?q={phone['name'].replace(' ', '+')}", "is_special": False},
        {"name": "Reliance Digital", "price": reliance_price, "stock": "In Stock", "url": f"https://www.reliancedigital.in/search?q={phone['name'].replace(' ', '+')}", "is_special": False}
    ]
    
    retailers.sort(key=lambda x: x['price'])
    return retailers


# Server-Sent Events stream for notifying connected clients about updates
@app.get('/api/stream')
async def stream():
    q: asyncio.Queue = asyncio.Queue()
    clients.append(q)

    async def event_generator():
        try:
            while True:
                data = await q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            return

    try:
        return EventSourceResponse(event_generator())
    finally:
        try:
            clients.remove(q)
        except ValueError:
            pass


# Simple phone lookup
@app.get('/api/phones/{phone_id}')
def get_phone(phone_id: int):
    phone = next((p for p in phone_data if p['id'] == phone_id), None)
    if not phone:
        raise HTTPException(status_code=404, detail='Phone not found')
    return phone


# Admin endpoint: add a new phone (requires ADMIN_KEY header when configured)
@app.post('/api/admin/phones')
async def add_phone(payload: dict, x_admin_key: Optional[str] = Header(None)):
    admin_key = os.environ.get('ADMIN_KEY')
    if admin_key and x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail='Forbidden')

    # basic validation
    required = ['brand', 'name', 'price']
    for f in required:
        if f not in payload:
            raise HTTPException(status_code=400, detail=f'Missing {f}')

    new_id = max((p.get('id', 0) for p in phone_data), default=0) + 1
    payload['id'] = new_id
    payload.setdefault('is_new', True)
    if not payload.get('about'):
        payload['about'] = generate_about(payload)

    phone_data.append(payload)
    save_data()

    # notify clients
    for q in list(clients):
        await q.put({'type': 'phones_updated', 'phone': payload})

    return payload


# Admin endpoint: update a phone
@app.put('/api/admin/phones/{phone_id}')
async def update_phone(phone_id: int, payload: dict, x_admin_key: Optional[str] = Header(None)):
    admin_key = os.environ.get('ADMIN_KEY')
    if admin_key and x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail='Forbidden')

    phone = next((p for p in phone_data if p['id'] == phone_id), None)
    if not phone:
        raise HTTPException(status_code=404, detail='Phone not found')

    phone.update(payload)
    if not phone.get('about'):
        phone['about'] = generate_about(phone)
    save_data()

    for q in list(clients):
        await q.put({'type': 'phones_updated', 'phone': phone})

    return phone

# Seed-based ratings so the same phone always gets the same score (deterministic)
def seeded_rating(phone_id: int, seller: str, base_min: float, base_max: float) -> float:
    seed = phone_id * 31 + sum(ord(c) for c in seller)
    random.seed(seed)
    rating = round(random.uniform(base_min, base_max), 1)
    random.seed()  # reset to real randomness for other endpoints
    return rating

@app.get("/api/ratings/{phone_id}")
async def get_ratings(phone_id: int):
    await asyncio.sleep(random.uniform(0.8, 1.5))

    phone = next((p for p in phone_data if p['id'] == phone_id), None)
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    sellers = [
        {"name": "Amazon India",     "weight": 0.30, "min": 3.5, "max": 4.8},
        {"name": "Flipkart",         "weight": 0.30, "min": 3.5, "max": 4.9},
        {"name": "Croma",            "weight": 0.15, "min": 3.8, "max": 4.7},
        {"name": "Reliance Digital", "weight": 0.10, "min": 3.6, "max": 4.6},
        {"name": "GSMArena",         "weight": 0.15, "min": 3.2, "max": 4.5},
    ]

    ratings = []
    weighted_sum = 0.0
    for s in sellers:
        score = seeded_rating(phone_id, s["name"], s["min"], s["max"])
        count = seeded_rating(phone_id, s["name"] + "_count", 200, 15000)
        count = int(count)
        weighted_sum += score * s["weight"]
        ratings.append({
            "seller": s["name"],
            "score": score,
            "out_of": 5.0,
            "review_count": count,
            "url": f"https://www.{'amazon.in' if 'Amazon' in s['name'] else 'flipkart.com' if 'Flipkart' in s['name'] else 'croma.com' if 'Croma' in s['name'] else 'reliancedigital.in' if 'Reliance' in s['name'] else 'gsmarena.com'}/search?q={phone['name'].replace(' ', '+')}",
        })

    return {
        "phone_id": phone_id,
        "phone_name": phone["name"],
        "average_rating": round(weighted_sum, 2),
        "total_reviews": sum(r["review_count"] for r in ratings),
        "breakdown": ratings,
    }

# ─── Rankings Endpoint ───────────────────────────────────────────────────────

PROCESSOR_TIERS = {
    "Apple A19 Pro": 100, "Apple A19": 97, "Apple A18": 92, "Apple A16 Bionic": 85,
    "Snapdragon 8 Elite Gen 5": 100, "Snapdragon 8 Elite": 97, "Snapdragon 8 Gen 3": 90,
    "Snapdragon 8 Gen 2": 85, "Snapdragon 8+ Gen 1": 80, "Snapdragon 7 Gen 3": 68,
    "Dimensity 9400": 95, "Dimensity 9300": 90, "Dimensity 7200 Pro": 62,
    "Google Tensor G5": 88, "Google Tensor G4": 82, "Google Tensor G3": 78,
    "Exynos 1580": 66, "Exynos 1380": 63,
}

def _norm(val, vals):
    mn, mx = min(vals), max(vals)
    return (val - mn) / (mx - mn) if mx != mn else 0.5

@app.get("/api/rankings")
async def get_rankings(period: str = "week", category: str = "popularity"):
    if not phone_data:
        return []

    phones = list(phone_data)
    prices    = [p.get('price', 0)       for p in phones]
    rams      = [p.get('ram', 0)         for p in phones]
    cameras   = [p.get('camera_mp', 0)   for p in phones]
    batteries = [p.get('battery_mah', 0) for p in phones]
    chargings = [p.get('charging_w', 0)  for p in phones]
    storages  = [p.get('storage_gb', 0)  for p in phones]
    refreshes = [p.get('refresh_hz', 60) for p in phones]

    def score_phone(p):
        proc  = PROCESSOR_TIERS.get(p.get('processor', ''), 60) / 100.0
        n_ram = _norm(p['ram'],         rams)
        n_cam = _norm(p['camera_mp'],   cameras)
        n_bat = _norm(p['battery_mah'], batteries)
        n_chg = _norm(p['charging_w'],  chargings)
        n_str = _norm(p['storage_gb'],  storages)
        n_ref = _norm(p['refresh_hz'],  refreshes)
        n_prc = _norm(p['price'],       prices)

        feat = 0.20*n_ram + 0.20*n_str + 0.15*n_ref + 0.25*n_cam + 0.20*n_bat

        if category == 'popularity':
            seed = p['id'] * 17 + (3 if period == 'week' else 7)
            random.seed(seed)
            pop = random.uniform(60, 100)
            random.seed()
            # Boost new phones in popularity
            new_boost = 5 if p.get('is_new', False) else 0
            s = pop * 0.8 + (1 - n_prc) * 20 + new_boost
        elif category == 'features':
            s = feat * 100
        elif category == 'camera':
            s = n_cam * 100
        elif category == 'battery':
            s = (0.6 * n_bat + 0.4 * n_chg) * 100
        elif category == 'power':
            s = (0.6 * proc + 0.4 * n_ram) * 100
        elif category == 'value':
            s = (feat / n_prc * 0.25) if n_prc > 0.05 else feat * 100
            s = min(s, 100)
        else:
            s = feat * 100

        seed2 = abs(p['id'] * 31 + (11 if period == 'week' else 23) + hash(category) % 100)
        random.seed(seed2)
        variation = random.uniform(-2.5, 2.5)
        random.seed()
        return round(min(99.9, max(0.1, s + variation)), 1)

    scored = sorted(
        [{**p, 'score': score_phone(p)} for p in phones],
        key=lambda x: x['score'], reverse=True
    )
    return [{**p, 'rank': i + 1} for i, p in enumerate(scored[:15])]

