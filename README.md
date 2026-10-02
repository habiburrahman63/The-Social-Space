# Frontend — Social Space

React 19 + Vite + Tailwind CSS single-page app. Talks to the Backend API
over HTTP via `src/utils/api.ts`.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev       # http://localhost:5173, proxies /api to the Backend
npm run build     # outputs static files to dist/
npm run preview   # preview the production build locally
npm run lint       # tsc --noEmit
```

## Configuring the Backend URL

`.env`:

```
VITE_API_URL=http://localhost:3000
```

- Set to the Backend's URL to call it directly (requires the Backend's
  `CORS_ORIGIN` to allow this origin).
- Leave empty (`VITE_API_URL=`) to make relative `/api/...` requests, which
  the Vite dev server proxies to the Backend automatically (see
  `vite.config.ts`), or which work directly if Frontend and Backend are
  served from the same host in production.

## Structure

```
Frontend/
├── src/
│   ├── components/     Feed, Friends, Messenger, Profile, AdminPanel, ...
│   ├── utils/            api.ts (HTTP client), presence.ts, toast.ts
│   ├── App.tsx, main.tsx, types.ts, index.css, vite-env.d.ts
├── public/                Static assets served as-is
├── index.html
├── vite.config.ts
└── package.json
```
