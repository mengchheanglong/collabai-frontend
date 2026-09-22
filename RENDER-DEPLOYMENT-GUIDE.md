# CollabAI Frontend — Render Deployment Guide

This guide walks through deploying the **CollabAI Frontend (Angular 19 SPA)** on [Render](https://render.com).

---

## Architecture on Render

- **Service Type**: **Static Site** (Free tier, global CDN edge network, instant cache invalidation, automated SSL)
- **Build Command**: `pnpm install && pnpm run build`
- **Publish Directory**: `dist/collabai-frontend/browser`
- **SPA Rewrites**: `/*` → `/index.html` (prevents 404s when navigating directly to client routes like `/login` or `/board`)
- **API Connection**: Build-time injection via `API_BASE_URL` (or `BACKEND_URL`) environment variable or runtime `window.__COLLABAI_CONFIG__` override

---

## Option 1: Blueprint Deployment (Recommended & Fastest)

Render supports Infrastructure-as-Code blueprints via `render.yaml`.

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your repository (`mengchheanglong/collabai-frontend`).
4. Render will detect `render.yaml` and configure:
   - **Static Site**: `collabai-web`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Publish Directory**: `dist/collabai-frontend/browser`
   - **Routes**: `/*` → `/index.html`
5. In the blueprint parameters, set:
   - `API_BASE_URL`: `https://collabai-api.onrender.com/api/v1` (replace with your backend's Render URL)
   - `SOCKET_URL`: `https://collabai-api.onrender.com`
6. Click **Apply**. Render will build and publish your SPA!

---

## Option 2: Manual Static Site Setup

If you prefer to configure manually via the Render UI:

### Step 1: Create a Static Site
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Static Site**.
3. Connect your repository `collabai-frontend`.
4. Configure the settings:
   - **Name**: `collabai-web`
   - **Branch**: `main`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Publish Directory**: `dist/collabai-frontend/browser`

### Step 2: Add SPA Rewrite Rule
To ensure Angular routing works when refreshing or entering deep URLs (like `/dashboard` or `/team`):
1. In your Static Site settings, go to the **Redirects/Rewrites** tab.
2. Click **Add Rule**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
3. Click **Save Changes**.

### Step 3: Configure Environment Variables
1. Go to the **Environment** tab.
2. Add the following environment variables:

| Key | Value / Description | Example |
| :--- | :--- | :--- |
| `API_BASE_URL` | Full URL to your backend `/api/v1` | `https://collabai-api.onrender.com/api/v1` |
| `SOCKET_URL` | Full URL to your backend host | `https://collabai-api.onrender.com` |

3. Click **Save Changes**. Render will automatically rebuild with your backend URL injected!

---

## Connecting Frontend to Backend

1. Ensure `API_BASE_URL` on the frontend Static Site matches your backend URL (e.g. `https://collabai-api.onrender.com/api/v1`).
2. Ensure `FRONTEND_ORIGIN` on the backend Web Service matches your frontend URL (e.g. `https://collabai-web.onrender.com`).
3. Deploy both services. All auth flows, task operations, and real-time updates will work seamlessly across the two Render services!
