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

cd app && cp .env.example .env && npm install && npx expo start   # a = Android, i = iOS (Expo Go)
```

**Website** (`website/`): a static page built from the price-list CSV, designed with the taste-skill
(`.claude/skills/design-taste-frontend`, direction "split stage"). The app's web screens (cart, checkout,
login, orders, admin) are served under `/shop` and share the cart with the page through the browser.

```bash
scripts/build-web.sh            # website + app web build into dist/
node scripts/serve-web.mjs      # http://localhost:8081 (website at /, app at /shop)
node .claude/skills/design-taste-frontend/scripts/inspect.mjs website/index.html   # design gate
```

On a phone or Android emulator, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (or `http://10.0.2.2:8000/api/v1` for the emulator).

Shop settings (UPI ID, UPI QR image, minimum order, packing %) are edited in the admin under **Shop settings**.

## Deploy

**Backend** (any Docker host: Render, Railway, a VPS). The image runs `start.sh`: migrate, collectstatic, gunicorn on `$PORT`.
Set `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` (long random string), `DATABASE_URL` (managed Postgres),
`DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and the `EMAIL_*` SMTP settings (see `backend/.env.example`).
Mount a persistent disk at `/app/media` so the UPI QR upload survives redeploys. Then run
`python manage.py import_products` once and `python manage.py createsuperuser` with your email.

**Website**: `API_URL=https://<api-host>/api/v1 scripts/build-web.sh`, then upload `dist/` to Cloudflare Pages with one
rewrite: `/shop/*` → `/shop/index.html`.

**Mobile apps**: `npx eas-cli@latest build` with the same `EXPO_PUBLIC_API_URL` (store submission is handled separately).
