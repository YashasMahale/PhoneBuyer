#!/usr/bin/env python3
"""
Simple importer to bulk add phones to dataset.json.

Usage:
  python importer.py phones.csv
  python importer.py phones.json

CSV should have columns like: brand,name,price,ram,camera_mp,battery_mah,storage_gb,display_inch,charging_w,processor,os,release_date,is_new

This script will append new entries to `dataset.json` and auto-generate an `about` field when missing.
"""
import json
import sys
from pathlib import Path


BASE = Path(__file__).parent
DATA_PATH = BASE / 'dataset.json'


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


def load_dataset():
    if DATA_PATH.exists():
        return json.loads(DATA_PATH.read_text(encoding='utf-8'))
    return []


def save_dataset(data):
    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def parse_csv(path):
    import csv
    rows = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            # try to coerce some numeric fields
            for key in ('price','ram','camera_mp','battery_mah','storage_gb','display_inch','charging_w'):
                if key in r and r[key] != '':
                    try:
                        r[key] = int(r[key]) if '.' not in r[key] else float(r[key])
                    except Exception:
                        pass
            # boolean
            if 'is_new' in r:
                r['is_new'] = r['is_new'].lower() in ('1','true','yes','y')
            rows.append(r)
    return rows


def parse_json(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return data


def main():
    if len(sys.argv) < 2:
        print('Usage: importer.py PATH_TO_CSV_OR_JSON')
        sys.exit(2)

    path = Path(sys.argv[1])
    if not path.exists():
        print('File not found:', path)
        sys.exit(2)

    if path.suffix.lower() == '.csv':
        new_items = parse_csv(path)
    else:
        new_items = parse_json(path)

    data = load_dataset()
    next_id = max((p.get('id', 0) for p in data), default=0) + 1
    for it in new_items:
        if 'id' not in it or not it.get('id'):
            it['id'] = next_id
            next_id += 1
        if not it.get('about'):
            it['about'] = generate_about(it)
        data.append(it)

    save_dataset(data)
    print(f'Imported {len(new_items)} items to {DATA_PATH}')


if __name__ == '__main__':
    main()
