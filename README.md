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
