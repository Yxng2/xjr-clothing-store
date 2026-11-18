# XJR PRINTING Clothing Store

A responsive clothing storefront for Nigeria and international customers. It includes a product catalogue, cart, customer artwork upload, manual order submission, and password-protected admin order management.

## Features

- Responsive storefront for mobile and desktop
- Starter T-shirt catalogue (₦8,000–₦14,000; editable in `data/products.json`)
- Shopping cart and order form
- JPG, PNG and WEBP customer artwork uploads (8MB maximum)
- Order reference numbers and status tracking in the admin area
- Admin statuses: Pending confirmation, Confirmed, In production, Ready for delivery, Delivered, Cancelled
- No online payment processing
- WhatsApp follow-up link
- Express backend and static HTML/CSS/JavaScript frontend

## Run locally

1. Install Node.js 20 or newer.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set a private `ADMIN_PASSWORD` and a long random `SESSION_SECRET` in `.env`.
6. Run `npm start`.
7. Open `http://localhost:10000`.

## Deploy on Render

This project is a Node web service.

- Repository: your GitHub repository
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Region: Frankfurt is a reasonable starting choice for Nigeria/West Africa
- Add environment variables:
  - `ADMIN_PASSWORD` — choose a strong private password
  - `SESSION_SECRET` — use a long random secret
  - `WHATSAPP_NUMBER` — digits only, international format, e.g. `2347015119367`
  - `NODE_ENV` — `production`

### Important: persistent storage

Orders, products and uploaded artwork are stored in `storage/`. Render's normal filesystem is temporary and can be cleared during redeploys/restarts. For real customer use, attach a Render persistent disk mounted at `/opt/render/project/src/data` and `/opt/render/project/src/uploads` (or update the paths in `server.js` to match the mount). A persistent disk may require a paid Render plan. Without persistent storage, treat this as a test deployment only.

## Admin

Open the **Store admin** section at the bottom of the website and sign in using `ADMIN_PASSWORD`. Do not share the password with customers.

## Editing products

Edit `data/products.json` using this format:

```json
[
  {
    "id": "tee-basic",
    "name": "Classic Round-Neck T-Shirt",
    "price": 8000,
    "description": "Everyday cotton round-neck T-shirt.",
    "image": "",
    "active": true
  }
]
```

Keep product IDs unique. Set `active` to `false` to hide a product.

## Artwork and AI design note

Customers can upload artwork and describe a design. This starter project sends those details with the order for your team to review. It does **not** generate AI images. Actual AI image generation needs an AI provider account and a private API key configured on the backend.

## Before launch

- Change the admin password and session secret.
- Configure persistent storage for orders and uploads.
- Test an order from a second phone.
- Confirm your delivery, payment-after-confirmation and refund policies.
- Add your final product photos and verified contact details.
