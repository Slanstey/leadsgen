# Getting Started with LeadsGen App

This guide walks you through setting up and running the LeadsGen application locally.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- Python (v3.9 or higher)
- pip (Python package manager)
- Git

## Project Structure

```
leadsgen/
├── src/              # Frontend React application
├── backend/          # Python FastAPI backend
├── supabase/         # Supabase configuration
└── api/              # Vercel serverless functions
```

## Setup Instructions

### 1. Clone the Repository (if not already done)

```bash
git clone <repository-url>
cd leadsgen
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Set Up Python Backend

#### Create and activate a virtual environment:

**On macOS/Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**On Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure Environment Variables

The project uses a `.env` file in the root directory. Make sure you have the following variables configured:

**Frontend Variables (VITE_ prefix):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

**Backend Variables (in backend/.env or root .env):**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
GOOGLE_API_KEY_ForSearchLinkedIn=your_google_api_key
GOOGLE_CSE_ID=your_google_cse_id
```

**Optional Variables:**
```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key
OPENAI_API_KEY=your_openai_api_key
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

### 5. Set Up Supabase

You have two options:

#### Option A: Use Supabase Cloud (Recommended for quick start)
- Use the credentials already configured in your `.env` file
- No additional setup needed

#### Option B: Run Supabase Locally
```bash
# Install Supabase CLI if not already installed
npm install supabase --save-dev

# Start Supabase locally
npx supabase start

# This will start:
# - Supabase Studio: http://127.0.0.1:54323
# - API: http://127.0.0.1:54321
# - DB: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Note: Local Supabase requires Docker to be installed and running.

## Running the Application

You need to run both the frontend and backend servers simultaneously. Use separate terminal windows for each.

### Terminal 1: Start the Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```

The backend will start on `http://localhost:8000`

**Backend API Endpoints:**
- Health check: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

### Terminal 2: Start the Frontend Development Server

```bash
# From the project root
npm run dev
```

The frontend will start on `http://localhost:5173` (or the next available port)

## Accessing the Application

Once both servers are running:

1. Open your browser and navigate to `http://localhost:5173`
2. You should see the LeadsGen application
3. The backend API is available at `http://localhost:8000`

## Common Commands

### Frontend Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run Playwright tests
npm run test:ui      # Run tests with UI
```

### Backend Commands

```bash
python app.py                    # Start FastAPI server
python test_linkedin_search.py  # Run backend tests
```

### Supabase Commands (if running locally)

```bash
npx supabase start    # Start local Supabase
npx supabase stop     # Stop local Supabase
npx supabase status   # Check status
npx supabase db reset # Reset database
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

**Frontend:**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5173   # Windows (then use taskkill)
```

**Backend:**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :8000   # Windows (then use taskkill)
```

### Python Dependencies Issues

```bash
# Upgrade pip
pip install --upgrade pip

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Node Modules Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Issues

1. Verify your `.env` file has the correct Supabase credentials
2. Check if Supabase project is active (if using cloud)
3. Ensure local Supabase is running (if using local setup)

## Development Workflow

1. Make changes to your code
2. Frontend changes will hot-reload automatically
3. Backend changes require restarting the Python server (Ctrl+C then `python app.py`)
4. Database changes can be made through Supabase Studio or migrations

## Quick Start (TL;DR)

```bash
# 1. Install dependencies
npm install

# 2. Set up backend
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 3. Ensure .env is configured

# 4. Start backend (in one terminal)
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python app.py

# 5. Start frontend (in another terminal)
npm run dev

# 6. Open http://localhost:5173 in your browser
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

## Support

For issues or questions, please check the project's issue tracker or contact the development team.
