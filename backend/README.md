# Python Backend for LinkedIn Search

This backend provides an API endpoint to search LinkedIn profiles using Google Custom Search API and save results to Supabase.

## Setup

1. Create and activate a virtual environment:

**On Windows:**
```bash
setup_venv.bat
```

**On Linux/Mac:**
```bash
chmod +x setup_venv.sh
./setup_venv.sh
```

**Or manually:**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

2. Create a `.env` file in the `backend` directory:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key
GOOGLE_API_KEY_ForSearchLinkedIn=your_google_api_key
GOOGLE_CSE_ID=your_google_cse_id
```

**Required Environment Variables:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (SECRET, NOT the anon key)
  - Find it in: Supabase Dashboard → Project Settings → API → `service_role` key (secret, starts with `eyJ...`)
  - The `service_role` key bypasses RLS and allows full database access
- `GOOGLE_API_KEY_ForSearchLinkedIn`: Your Google Custom Search API key
  - Get it from: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - Should start with `AIza...` and be ~39 characters long
- `GOOGLE_CSE_ID`: Your Google Custom Search Engine ID
  - Get it from: [Google Custom Search Engine Control Panel](https://programmablesearchengine.google.com/controlpanel)
  - Format: `numbers:letters` (e.g., `017576662512468239146:omuauf_lfve`)
  - Make sure your CSE is configured to search `linkedin.com/in`

3. Activate the virtual environment (if not already activated):

**On Windows:**
```bash
venv\Scripts\activate
```

**On Linux/Mac:**
```bash
source venv/bin/activate
```

4. Run the server:
```bash
python app.py
```

Or with uvicorn directly:
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### POST /api/search-linkedin
Search LinkedIn profiles and save to leads table.

**Request Body:**
```json
{
  "locations": ["New York", "San Francisco"],
  "positions": ["CEO", "CTO"],
  "experience_operator": "=",
  "experience_years": 5,
  "tenant_id": "tenant-uuid",
  "limit": 10
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "profiles_found": 10,
  "leads_created": 10
}
```

### GET /api/health
Health check endpoint.

