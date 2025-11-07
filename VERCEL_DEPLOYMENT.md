# Vercel Deployment Guide

This project is configured for deployment on Vercel with both frontend (React/Vite) and backend (FastAPI/Python) components.

## Project Structure

- **Frontend**: React + Vite application (builds to `dist/`)
- **Backend**: FastAPI Python application (deployed as serverless functions in `api/`)

## Build Commands

The following build commands are available in `package.json`:

- `npm run build` - Builds frontend and syncs backend files
- `npm run build:dev` - Builds frontend in development mode and syncs backend files
- `npm run build:sync-backend` - Syncs backend files to `api/backend/` for Vercel
- `npm run build:all` - Alias for `npm run build`

## Vercel Configuration

The `vercel.json` file configures:

1. **Frontend Build**: Uses `npm run build` to build the Vite app
2. **Backend Functions**: Python serverless functions in `api/index.py`
3. **Routing**: 
   - `/api/*` routes to Python backend
   - All other routes serve the React app

## Environment Variables

Set these in your Vercel project settings:

### Required Backend Variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (secret)
- `GOOGLE_API_KEY_ForSearchLinkedIn` - Google Custom Search API key
- `GOOGLE_CSE_ID` - Google Custom Search Engine ID

### Required Frontend Variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_BACKEND_URL` - Backend API URL (use Vercel's deployment URL, e.g., `https://your-project.vercel.app`)

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
   - `build:sync-backend` copies backend files from `backend/` to `api/backend/`
   - Vite builds the frontend to `dist/`

2. **Runtime**:
   - Frontend static files are served from `dist/`
   - API requests to `/api/*` are handled by `api/index.py` (Python serverless function)
   - The Python function uses Mangum to wrap the FastAPI app

3. **File Sync**:
   - Backend files are automatically synced during build via `scripts/sync-backend.cjs`
   - This ensures `api/backend/` always has the latest backend code

## Troubleshooting

- **Python dependencies**: Make sure `api/requirements.txt` includes all necessary packages
- **Environment variables**: Verify all variables are set in Vercel dashboard
- **Build errors**: Check Vercel build logs for specific errors
- **API routes not working**: Verify `vercel.json` routing configuration

## Local Development

For local development, run:

```bash
# Frontend (port 8080)
npm run dev

# Backend (port 8000) - in separate terminal
cd backend
python app.py
```

The sync script runs automatically on `npm install` (via `postinstall` hook).

