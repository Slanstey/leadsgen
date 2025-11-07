# Vercel Deployment Checklist

## Pre-Deployment

- [x] Frontend code in root directory (`src/`, `package.json`, `vite.config.ts`)
- [x] Backend code in `backend/` directory (`backend/app.py`, `backend/services/`)
- [x] Vercel serverless entry point in `api/index.py`
- [x] `api/index.py` imports from `../backend/` (monorepo structure)
- [x] `vercel.json` configured with correct routing
- [x] `api/requirements.txt` matches `backend/requirements.txt` (except uvicorn)

## Environment Variables to Set in Vercel

### Backend (for `/api/*` endpoints):
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (starts with `eyJ...`)
- [ ] `GOOGLE_API_KEY_ForSearchLinkedIn` - Google API key (starts with `AIza...`)
- [ ] `GOOGLE_CSE_ID` - Google CSE ID (format: `numbers:letters`)

### Frontend (for React app):
- [ ] `VITE_SUPABASE_URL` - Same as `SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `VITE_BACKEND_URL` - Set to your Vercel URL after first deploy (e.g., `https://your-project.vercel.app`)

## Deployment Steps

1. **Push to Git** (if using Git integration):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. **Deploy via Vercel CLI**:
   ```bash
   vercel
   ```

3. **Set Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables listed above
   - **Important**: Set `VITE_BACKEND_URL` to your deployment URL after first deploy

4. **Redeploy** (after setting environment variables):
   ```bash
   vercel --prod
   ```

## Post-Deployment

- [ ] Verify frontend loads at your Vercel URL
- [ ] Test `/api/health` endpoint (should return `{"status": "ok"}`)
- [ ] Test login functionality
- [ ] Test saving preferences
- [ ] Test LinkedIn search (if configured)

## Project Structure

```
LeadsGen/                    # Root (frontend)
├── src/                     # React frontend code
├── package.json             # Frontend dependencies & build
├── vite.config.ts           # Vite configuration
├── dist/                    # Frontend build output (generated)
│
├── backend/                 # Backend Python code (monorepo)
│   ├── app.py              # FastAPI application
│   ├── services/           # Backend services
│   │   └── linkedin_search.py
│   └── requirements.txt    # Python dependencies
│
└── api/                    # Vercel serverless entry point
    ├── index.py            # Imports from ../backend/
    └── requirements.txt    # Python dependencies (matches backend/)
```

## How It Works

1. **Frontend**: Built from root using `npm run build` → outputs to `dist/`
2. **Backend**: Deployed as serverless function via `api/index.py`
3. **Monorepo**: `api/index.py` imports from `../backend/` - no file duplication
4. **Routing**: 
   - `/api/*` → Python serverless function (`api/index.py`)
   - `/*` → React app (`dist/index.html`)

