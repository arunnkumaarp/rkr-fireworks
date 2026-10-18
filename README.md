# RKR Crackers

Price list, cart and estimate ordering for RKR Crackers, as one website + Android/iOS app.

- `backend/` Django REST API (catalogue, estimates, shop settings). Admin at `/django-admin/`.
- `app/` Expo (React Native) app; the same code builds the website.

## Run

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py import_products   # loads seed/products_2026.csv
docker compose exec backend python manage.py createsuperuser
docker compose exec backend pytest

cd app && cp .env.example .env && npm install && npx expo start   # w = web, a = Android, i = iOS
```

On a phone or Android emulator, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (or `http://10.0.2.2:8000/api/v1` for the emulator).

Shop settings (UPI ID, UPI QR image, minimum order, packing %) are edited in the admin under **Shop settings**.

## Deploy

**Backend** (any Docker host: Render, Railway, a VPS). The image runs `start.sh`: migrate, collectstatic, gunicorn on `$PORT`.
Set `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` (long random string), `DATABASE_URL` (managed Postgres),
`DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and the `EMAIL_*` SMTP settings (see `backend/.env.example`).
Mount a persistent disk at `/app/media` so the UPI QR upload survives redeploys. Then run
`python manage.py import_products` once and `python manage.py createsuperuser` with your email.

**Website**: `cd app && EXPO_PUBLIC_API_URL=https://<api-host>/api/v1 npx expo export --platform web`, then upload `app/dist/`
to Vercel or Netlify as a single-page app (rewrite all paths to `/index.html`).

**Mobile apps**: `npx eas-cli@latest build` with the same `EXPO_PUBLIC_API_URL` (store submission is handled separately).
