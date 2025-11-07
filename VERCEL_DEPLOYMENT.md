# Vercel Deployment Guide

This project is configured as a **monorepo** for deployment on Vercel with both frontend (React/Vite) and backend (FastAPI/Python) components.

## Project Structure (Monorepo)

```
LeadsGen/
├── backend/           # Backend Python code (single source of truth)
│   ├── app.py
│   ├── services/
│   └── requirements.txt
├── api/               # Vercel serverless function entry point
│   ├── index.py       # Imports from ../backend/
│   └── requirements.txt
├── src/               # Frontend React/Vite code
└── dist/              # Frontend build output
```

**Key Points:**
- Backend files exist **only once** in `backend/` directory
- `api/index.py` imports directly from `../backend/` (monorepo structure)
- No file duplication or sync scripts needed

## Build Commands

The following build commands are available in `package.json`:

- `npm run build` - Builds frontend (Vite)
- `npm run build:dev` - Builds frontend in development mode
- `npm run build:all` - Alias for `npm run build`

**Note:** Backend files are referenced directly - no sync step needed.

## Vercel Configuration

The `vercel.json` file configures:

1. **Frontend Build**: Uses `npm run build` to build the Vite app to `dist/`
2. **Backend Functions**: Python serverless functions in `api/index.py` (auto-detected by Vercel)
3. **Routing**: 
   - `/api/*` routes to Python backend (`api/index.py`)
   - All other routes serve the React app (`dist/`)

**Vercel automatically detects Python functions** in the `api/` directory - no explicit runtime configuration needed in `vercel.json`.

## Environment Variables

Set these in your Vercel project settings (Project Settings → Environment Variables):

### Required Backend Variables (for `/api/*` endpoints):
- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (secret, starts with `eyJ...`)
- `GOOGLE_API_KEY_ForSearchLinkedIn` - Google Custom Search API key (starts with `AIza...`)
- `GOOGLE_CSE_ID` - Google Custom Search Engine ID (format: `numbers:letters`)

### Required Frontend Variables (for React app):
- `VITE_SUPABASE_URL` - Your Supabase project URL (same as `SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (public key)
- `VITE_BACKEND_URL` - Backend API URL (set this to your Vercel deployment URL after first deploy, e.g., `https://your-project.vercel.app`)

**Important**: After your first deployment, update `VITE_BACKEND_URL` to your actual Vercel URL, then redeploy.

## Deployment Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel
   ```

3. **Set Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all required variables listed above

4. **Redeploy** after setting environment variables:
   ```bash
   vercel --prod
   ```

## How It Works

1. **Build Process**:
   - Vite builds the frontend to `dist/`
   - Backend code is referenced directly from `backend/` directory (no copying needed)

2. **Runtime**:
   - Frontend static files are served from `dist/`
   - API requests to `/api/*` are handled by `api/index.py` (Python serverless function)
   - `api/index.py` imports from `../backend/` using Python path manipulation
   - The Python function uses Mangum to wrap the FastAPI app

3. **Monorepo Benefits**:
   - Single source of truth for backend code
   - No file duplication or sync scripts
   - Changes to backend code are automatically reflected
   - Cleaner repository structure

## Troubleshooting

- **Python dependencies**: Make sure `api/requirements.txt` matches `backend/requirements.txt`
- **Environment variables**: Verify all variables are set in Vercel dashboard
- **Build errors**: Check Vercel build logs for specific errors
- **API routes not working**: Verify `vercel.json` routing configuration
- **Import errors**: Ensure `api/index.py` correctly references `../backend/` path

## Local Development

For local development, run:

```bash
# Frontend (port 8080)
npm run dev

# Backend (port 8000) - in separate terminal
cd backend
python app.py
```

## Monorepo Best Practices

- **Backend code**: Edit files in `backend/` directory only
- **API entry point**: Only modify `api/index.py` if you need to change how Vercel loads the backend
- **Requirements**: Keep `api/requirements.txt` and `backend/requirements.txt` in sync
- **No duplication**: Never copy backend files - always reference them directly

