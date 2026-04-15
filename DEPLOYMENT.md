# Production Deployment Guide

## Frontend (React + Vite)
- Build output: `frontend/dist/`
- To serve statically, use any static server (Vercel, Netlify, Surge, Nginx, etc.)
- For local preview: `npm run preview` in `frontend/`

## Backend (FastAPI)
- Main app: `backend/main.py`
- Requirements: `backend/requirements.txt`
- Run in production (recommended):
  ```sh
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```
- For deployment: Use services like Render, Railway, Fly.io, or Dockerize for cloud.

Real-time updates and phone additions
- The backend exposes a Server-Sent Events stream at `/api/stream` that clients can subscribe to for real-time updates when the phone catalog changes.
- Admin endpoints to add/update phones live at:
  - `POST /api/admin/phones` — add a single phone (JSON body). Requires `X-Admin-Key` header when `ADMIN_KEY` env var is set.
  - `PUT /api/admin/phones/{id}` — update phone by id (JSON body). Requires `X-Admin-Key` when `ADMIN_KEY` is set.
- Example add (curl):

```sh
curl -X POST "http://localhost:8000/api/admin/phones" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"brand":"Test","name":"T-Phone","price":19999,"ram":6,"camera_mp":12,"battery_mah":4000}'
```

Bulk import
- Use `backend/importer.py` to bulk import a CSV/JSON of phones into `backend/dataset.json`:

```sh
python backend/importer.py phones.csv
```

About generation
- When a phone entry lacks an `about` field, the backend auto-generates a short description from specs so the UI always has knowledge text to display.

## CORS
- CORS is enabled for all origins for easy frontend-backend connection.
- For production, restrict `allow_origins` in `main.py` to your frontend domain.

## Environment Variables
- For sensitive configs, use environment variables and never hardcode secrets.

## General Tips
- Always run `npm run build` before deploying frontend.
- Keep `requirements.txt` up to date for backend.
- Monitor logs and errors after deployment.
- Use HTTPS in production.

---

For any issues, check logs or reach out to the maintainer.
