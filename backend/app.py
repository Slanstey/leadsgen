from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError as PostgrestAPIError
import requests
import re
from typing import Dict, Any
import logging

# Set up logging to write to console/CMD
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler()  # Explicitly write to stdout/console
    ]
)
logger = logging.getLogger(__name__)
logger.info("=" * 60)
logger.info("Logging initialized - all logs will be written to console/CMD")
logger.info("=" * 60)

load_dotenv()

app = FastAPI()

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# CORS middleware - must be added before other middleware to handle OPTIONS properly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error(f"Validation error: {exc.errors()}")
    logger.error(f"Request body: {body.decode() if body else 'Empty body'}")
    logger.error(f"Request headers: {dict(request.headers)}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": body.decode() if body else "Empty body"},
    )

# Initialize Supabase client
# IMPORTANT: Use SERVICE_ROLE_KEY (secret key), not ANON_KEY (publishable key)
# The service_role key bypasses RLS and allows full database access
# The anon key is subject to RLS policies and won't work for backend operations
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL must be set in environment variables")

if not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.\n"
        "This should be the SERVICE_ROLE key (secret), not the ANON key (publishable).\n"
        "Find it in: Supabase Dashboard → Project Settings → API → service_role key (secret)"
    )

# Verify it's the service_role key (starts with eyJ... and is much longer than anon key)
if not SUPABASE_SERVICE_KEY.startswith("eyJ") or len(SUPABASE_SERVICE_KEY) < 100:
    logger.warning(
        "WARNING: SUPABASE_SERVICE_ROLE_KEY might be the anon key instead of service_role key.\n"
        "Service role keys are longer and start with 'eyJ'. Make sure you're using the SECRET key, not the publishable key."
    )

# Create client with service role key (bypasses RLS)
# IMPORTANT: The second parameter MUST be the service_role key for RLS bypass
# The Supabase Python client automatically uses this key in the apikey header
supabase: Client = create_client(
    SUPABASE_URL, 
    SUPABASE_SERVICE_KEY  # This is the service_role key - it bypasses RLS
)

# Log the key being used (first/last few chars for verification)
logger.info(f"Using Supabase URL: {SUPABASE_URL}")
logger.info(f"Service role key (first 30): {SUPABASE_SERVICE_KEY[:30]}...")
logger.info(f"Service role key (last 30): ...{SUPABASE_SERVICE_KEY[-30:]}")
logger.info(f"Key length: {len(SUPABASE_SERVICE_KEY)} characters")

# Verify the key contains the correct project reference
import base64
import json
try:
    # Decode JWT to verify project
    parts = SUPABASE_SERVICE_KEY.split('.')
    if len(parts) >= 2:
        payload = base64.urlsafe_b64decode(parts[1] + '==')
        jwt_data = json.loads(payload)
        logger.info(f"JWT project ref: {jwt_data.get('ref')}")
        logger.info(f"JWT role: {jwt_data.get('role')}")
        if jwt_data.get('role') != 'service_role':
            logger.error("⚠️  WARNING: Key role is not 'service_role'!")
except Exception as e:
    logger.warning(f"Could not decode JWT: {e}")

# Verify connection on startup
try:
    logger.info("Verifying Supabase connection with service_role key...")
    test_result = supabase.table("user_profiles").select("id").limit(1).execute()
    logger.info(f"✅ Supabase connection verified. Service role key is working. Found {len(test_result.data) if test_result.data else 0} user profiles.")
except Exception as e:
    logger.error(
        f"❌ Supabase connection test failed: {e}\n"
        "This usually means:\n"
        "1. You're using the ANON key instead of SERVICE_ROLE key\n"
        "2. RLS policies are blocking access\n"
        "3. The key is incorrect\n"
        "Check your .env file and ensure SUPABASE_SERVICE_ROLE_KEY is set to the SECRET service_role key."
    )

# Google API configuration - read from environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY_ForSearchLinkedIn")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

# Validate that both required environment variables are set
if not GOOGLE_API_KEY:
    logger.error("=" * 60)
    logger.error("❌ CRITICAL ERROR: GOOGLE_API_KEY_ForSearchLinkedIn environment variable is not set!")
    logger.error("   Please set GOOGLE_API_KEY_ForSearchLinkedIn in your .env file")
    logger.error("   Example: GOOGLE_API_KEY_ForSearchLinkedIn=your_api_key_here")
    logger.error("=" * 60)
    raise ValueError("GOOGLE_API_KEY_ForSearchLinkedIn environment variable is required")

if not GOOGLE_CSE_ID:
    logger.error("=" * 60)
    logger.error("❌ CRITICAL ERROR: GOOGLE_CSE_ID environment variable is not set!")
    logger.error("   Please set GOOGLE_CSE_ID in your .env file")
    logger.error("   Example: GOOGLE_CSE_ID=017576662512468239146:omuauf_lfve")
    logger.error("   Get your CSE ID from: https://programmablesearchengine.google.com/controlpanel")
    logger.error("=" * 60)
    raise ValueError("GOOGLE_CSE_ID environment variable is required")

# Log Google API configuration at startup
logger.info("")
logger.info("=" * 60)
logger.info("Google Custom Search API Configuration")
logger.info("=" * 60)
logger.info(f"API Key Source: Environment variable 'GOOGLE_API_KEY_ForSearchLinkedIn'")
logger.info(f"API Key (first 20 chars): {GOOGLE_API_KEY[:20]}...")
logger.info(f"API Key length: {len(GOOGLE_API_KEY)} characters")
logger.info(f"CSE ID Source: Environment variable 'GOOGLE_CSE_ID'")
logger.info(f"CSE ID: {GOOGLE_CSE_ID}")
logger.info(f"CSE ID length: {len(GOOGLE_CSE_ID)} characters")

# Validate API Key format (should start with 'AIza' and be ~39 characters)
if not GOOGLE_API_KEY.startswith("AIza"):
    logger.warning("⚠️  WARNING: API Key format looks unusual (should start with 'AIza')")
elif len(GOOGLE_API_KEY) < 30 or len(GOOGLE_API_KEY) > 50:
    logger.warning(f"⚠️  WARNING: API Key length ({len(GOOGLE_API_KEY)}) seems unusual (typically 39 characters)")
else:
    logger.info("✓ API Key format looks correct")

# Validate CSE ID format (should be numbers:letters or similar)
if ":" in GOOGLE_CSE_ID:
    logger.info("✓ CSE ID format looks correct (contains colon separator)")
elif GOOGLE_CSE_ID.replace("-", "").isalnum():
    logger.info("✓ CSE ID format looks correct (alphanumeric)")
else:
    logger.warning("⚠️  WARNING: CSE ID format looks unusual")
    logger.warning("   CSE ID should be in format: 'numbers:letters' (e.g., '017576662512468239146:omuauf_lfve')")

# Check if CSE ID accidentally matches API key
if GOOGLE_CSE_ID == GOOGLE_API_KEY:
    logger.error("=" * 60)
    logger.error("❌ CRITICAL ERROR: CSE ID is set to API Key!")
    logger.error("   The GOOGLE_CSE_ID environment variable is incorrectly set.")
    logger.error("   CSE ID should be your Custom Search Engine ID (e.g., '017576662512468239146:omuauf_lfve')")
    logger.error("   NOT your API key!")
    logger.error("=" * 60)
    raise ValueError("GOOGLE_CSE_ID cannot be the same as GOOGLE_API_KEY_ForSearchLinkedIn")
elif len(GOOGLE_CSE_ID) < 10:
    logger.warning("⚠️  WARNING: CSE ID seems too short. Verify it's correct.")
    
logger.info("=" * 60)
logger.info("✓ Google API configuration validated successfully")
logger.info("=" * 60)
logger.info("")


class LinkedInSearchRequest(BaseModel):
    locations: List[str]
    positions: List[str]
    experience_operator: str = "="
    experience_years: int = 0
    tenant_id: str
    limit: int = 10


class LinkedInSearchResponse(BaseModel):
    success: bool
    profiles_found: int
    leads_created: int
    error: Optional[str] = None


def verify_auth(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token and return user info"""
    logger.info(f"Authorization header: {authorization[:20] if authorization else None}...")
    
    if not authorization:
        logger.error("No authorization header provided")
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    # Handle both "Bearer token" and just "token" formats
    if authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    else:
        token = authorization
    
    try:
        # Verify token with Supabase
        logger.info("Verifying token with Supabase...")
        response = supabase.auth.get_user(token)
        
        if not response.user:
            logger.error("Invalid token - no user returned")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        logger.info(f"User authenticated: {response.user.id}")
        
        # Get user profile to verify tenant_id
        # Note: Users can be manually assigned to any tenant, regardless of email domain
        # The tenant_id from user_profiles table is the source of truth
        try:
            logger.info(f"Querying user_profiles for user_id: {response.user.id}")
            # Use limit(1) instead of single() to avoid exception when no rows found
            profile_result = supabase.table("user_profiles").select("tenant_id").eq("id", response.user.id).limit(1).execute()
            
            logger.info(f"Query result: data={profile_result.data}, count={len(profile_result.data) if profile_result.data else 0}")
            
            if not profile_result.data or len(profile_result.data) == 0:
                # Try querying all columns to see if there's any data at all
                logger.warning(f"No profile found with tenant_id. Trying full select...")
                full_profile = supabase.table("user_profiles").select("*").eq("id", response.user.id).limit(1).execute()
                logger.info(f"Full profile query result: {full_profile.data}")
                
                if not full_profile.data or len(full_profile.data) == 0:
                    logger.error(f"No profile found for user {response.user.id} - profile does not exist in database")
                    raise HTTPException(
                        status_code=404, 
                        detail="User profile not found. Please complete your profile setup in the application."
                    )
                else:
                    # Profile exists but tenant_id might be null
                    logger.warning(f"Profile exists but tenant_id is missing: {full_profile.data[0]}")
                    raise HTTPException(
                        status_code=404,
                        detail="User profile exists but tenant_id is not set. Please contact support."
                    )
            
            tenant_id = profile_result.data[0].get("tenant_id")
            logger.info(f"User tenant_id: {tenant_id}")
            
            if not tenant_id:
                logger.error(f"No tenant_id found for user {response.user.id}")
                raise HTTPException(status_code=404, detail="User tenant not found. Please contact support.")
            
            return {
                "user_id": response.user.id,
                "tenant_id": tenant_id  # This tenant_id from user_profiles is validated against request
            }
        except HTTPException:
            raise
        except PostgrestAPIError as e:
            # Handle Postgrest API errors
            error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
            logger.error(f"Postgrest error fetching user profile: {e}")
            if error_dict.get('code') == 'PGRST116':
                raise HTTPException(
                    status_code=404, 
                    detail="User profile not found. Please complete your profile setup in the application."
                )
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching user profile: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error fetching user profile: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def search_linkedin_profiles(
    locations: List[str],
    positions: List[str],
    experience_operator: str,
    experience_years: int,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search LinkedIn profiles using Google Custom Search API
    Based on ConneXion for LinkedIn approach: https://github.com/ethbak/connexion-for-linkedin
    
    Instead of writing to Excel, we return profiles to be inserted into the database.
    Filter data is received from UI fields via the API endpoint.
    """
    logger.info("")
    logger.info("=" * 80)
    logger.info("LINKEDIN PROFILE SEARCH - STARTING")
    logger.info("=" * 80)
    logger.info(f"Search Parameters:")
    logger.info(f"  - Locations: {locations}")
    logger.info(f"  - Positions: {positions}")
    logger.info(f"  - Experience Operator: {experience_operator}")
    logger.info(f"  - Experience Years: {experience_years}")
    logger.info(f"  - Limit: {limit}")
    logger.info("")
    
    profiles = []
    processed_urls = set()
    total_queries = len(locations) * len(positions)
    current_query = 0
    
    logger.info(f"Will process {len(locations)} location(s) × {len(positions)} position(s) = {total_queries} search query/queries")
    logger.info("")
    
    for location_idx, location in enumerate(locations):
        location = location.strip()
        logger.info(f"[LOCATION {location_idx + 1}/{len(locations)}] Processing: '{location}'")
        
        for position_idx, position in enumerate(positions):
            if len(profiles) >= limit:
                logger.info(f"✓ Reached limit of {limit} profiles. Stopping search.")
                break
            
            position = position.strip()
            current_query += 1
            logger.info(f"  [QUERY {current_query}/{total_queries}] Searching: '{position}' in '{location}'")
            
            # Build search query following ConneXion pattern: site:linkedin.com/in {position} {location}
            query = f"site:linkedin.com/in {position} {location}"
            
            # Add experience filter (matching ConneXion's experience dropdown logic)
            if experience_years > 0:
                years_text = f"{experience_years} years"
                if experience_operator == ">":
                    query += f' "{years_text}" OR "{experience_years}+ years"'
                elif experience_operator == "<":
                    query += f' "less than {years_text}" OR "junior" OR "entry level"'
                else:  # "="
                    query += f' "{years_text}"'
            
            logger.info(f"    → Built Google search query: {query}")
            
            try:
                # Make Google Custom Search API request (matching ConneXion's API usage)
                logger.info(f"    → Making Google Custom Search API request...")
                search_url = "https://www.googleapis.com/customsearch/v1"
                params = {
                    "key": GOOGLE_API_KEY,
                    "cx": GOOGLE_CSE_ID,
                    "q": query,
                    "num": 10  # Google API returns up to 10 results per request
                }
                
                logger.info(f"    → API URL: {search_url}")
                logger.info(f"    → API Parameters:")
                logger.info(f"        - key: {GOOGLE_API_KEY[:20]}... (length: {len(GOOGLE_API_KEY)})")
                logger.info(f"        - cx (CSE ID): {GOOGLE_CSE_ID} (length: {len(GOOGLE_CSE_ID)})")
                logger.info(f"        - q: {query[:80]}...")
                logger.info(f"        - num: 10")
                
                # Validate CSE ID before making request
                if GOOGLE_CSE_ID == GOOGLE_API_KEY:
                    error_msg = "CSE ID is incorrectly set to API key! Check GOOGLE_CSE_ID environment variable."
                    logger.error(f"    ✗ CONFIGURATION ERROR: {error_msg}")
                    raise ValueError(error_msg)
                
                response = requests.get(search_url, params=params, timeout=10)
                logger.info(f"    → API Response Status: {response.status_code}")
                
                # If we get a 400 error, log the response body for debugging
                if response.status_code == 400:
                    try:
                        error_data = response.json()
                        logger.error(f"    → API Error Response: {error_data}")
                    except:
                        logger.error(f"    → API Error Response (text): {response.text[:500]}")
                
                response.raise_for_status()
                
                data = response.json()
                items_count = len(data.get('items', []))
                logger.info(f"    → Google API returned {items_count} result(s)")
                
                if "items" in data and items_count > 0:
                    logger.info(f"    → Processing {items_count} profile(s)...")
                    
                    for item_idx, item in enumerate(data["items"]):
                        if len(profiles) >= limit:
                            logger.info(f"    → Reached limit, stopping profile processing")
                            break
                        
                        url = item.get("link", "")
                        if not url:
                            logger.warning(f"      [Profile {item_idx + 1}] Skipping - no URL found")
                            continue
                            
                        if url in processed_urls:
                            logger.info(f"      [Profile {item_idx + 1}] Skipping duplicate URL: {url[:60]}...")
                            continue
                        
                        processed_urls.add(url)
                        
                        # Extract profile information (following ConneXion's extraction patterns)
                        snippet = item.get("snippet", "")
                        title = item.get("title", "")
                        
                        logger.info(f"      [Profile {item_idx + 1}/{items_count}] Processing: {title[:60]}...")
                        logger.info(f"        URL: {url}")
                        
                        # Extract name
                        name = extract_name(title, snippet, url)
                        logger.info(f"        Name: {name}")
                        
                        # Extract company
                        company = extract_company(snippet, title)
                        logger.info(f"        Company: {company}")
                        
                        # Extract role
                        role = extract_role(snippet, title, positions)
                        logger.info(f"        Role: {role}")
                        
                        profile_data = {
                            "name": name,
                            "company": company,
                            "role": role,
                            "url": url,
                            "snippet": snippet
                        }
                        
                        profiles.append(profile_data)
                        logger.info(f"        ✓ Added profile {len(profiles)}/{limit} to results")
                        logger.info("")
                else:
                    logger.warning(f"    → No profiles found in API response for this query")
                    logger.info("")
                
                # Small delay to respect API rate limits (ConneXion uses delays between requests)
                import time
                time.sleep(0.1)
                
            except requests.exceptions.Timeout:
                logger.error(f"    ✗ TIMEOUT ERROR: Request timed out after 10 seconds")
                logger.error(f"    → Skipping this query and continuing...")
                logger.info("")
                continue
            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code if hasattr(e, 'response') and e.response else 'unknown'
                logger.error(f"    ✗ HTTP ERROR: {e}")
                logger.error(f"    → Status Code: {status_code}")
                logger.error(f"    → Skipping this query and continuing...")
                logger.info("")
                continue
            except Exception as e:
                logger.error(f"    ✗ UNEXPECTED ERROR: {e}")
                logger.error(f"    → Error Type: {type(e).__name__}")
                logger.error(f"    → Skipping this query and continuing...")
                import traceback
                logger.error(f"    → Traceback:\n{traceback.format_exc()}")
                logger.info("")
                continue
        
        if len(profiles) >= limit:
            logger.info(f"✓ Reached limit after processing location '{location}'")
            break
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("LINKEDIN PROFILE SEARCH - COMPLETED")
    logger.info("=" * 80)
    logger.info(f"Total profiles found: {len(profiles)}")
    logger.info(f"Total unique URLs processed: {len(processed_urls)}")
    logger.info(f"Profiles to be inserted into database: {len(profiles)}")
    logger.info("=" * 80)
    logger.info("")
    
    return profiles[:limit]


def extract_name(title: str, snippet: str, url: str) -> str:
    """
    Extract name from LinkedIn profile data
    Following ConneXion's name extraction patterns
    """
    name_patterns = [
        r"^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",  # "John Doe" or "John Doe Smith"
        r"([A-Z][a-z]+ [A-Z][a-z]+)\s*[-|]",  # "John Doe -"
        r"([A-Z][a-z]+ [A-Z][a-z]+)\s+at",  # "John Doe at"
    ]
    
    for pattern_idx, pattern in enumerate(name_patterns):
        match = re.search(pattern, title) or re.search(pattern, snippet)
        if match:
            name = match.group(1).strip()
            logger.debug(f"          Name extracted using pattern {pattern_idx + 1}: {name}")
            return name
    
    # Fallback to URL
    url_match = re.search(r"linkedin\.com/in/([^/?]+)", url)
    if url_match:
        url_name = url_match.group(1).replace("-", " ")
        name = " ".join(word.capitalize() for word in url_name.split())
        logger.debug(f"          Name extracted from URL: {name}")
        return name
    
    logger.warning(f"          Could not extract name, using 'Unknown'")
    return "Unknown"


def extract_company(snippet: str, title: str) -> str:
    """
    Extract company name from LinkedIn profile data
    Following ConneXion's company extraction patterns
    """
    company_patterns = [
        r"at\s+([A-Z][^,\.\n]+?)(?:\s*[-|,\.]|\s+at|\s*$)",
        r"([A-Z][a-zA-Z\s&]+)\s*[-|]\s*(?:CEO|CTO|VP|Director|Manager|Engineer)",
        r"(?:works? at|current|previous)[:\s]+([A-Z][^,\.\n]+)",
    ]
    
    for pattern_idx, pattern in enumerate(company_patterns):
        match = re.search(pattern, snippet, re.IGNORECASE) or re.search(pattern, title, re.IGNORECASE)
        if match and match.group(1):
            company = match.group(1).strip()
            company = re.sub(r"^\s*at\s+", "", company, flags=re.IGNORECASE)
            if 2 < len(company) < 100:
                logger.debug(f"          Company extracted using pattern {pattern_idx + 1}: {company}")
                return company
    
    logger.warning(f"          Could not extract company, using 'Unknown Company'")
    return "Unknown Company"


def extract_role(snippet: str, title: str, positions: List[str]) -> str:
    """
    Extract role from LinkedIn profile data
    Following ConneXion's role extraction patterns
    """
    role_patterns = [
        r"([A-Z][^,\.]+?)\s+at\s+[A-Z]",
        r"(CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Analyst)",
    ]
    
    for pattern_idx, pattern in enumerate(role_patterns):
        match = re.search(pattern, snippet, re.IGNORECASE) or re.search(pattern, title, re.IGNORECASE)
        if match:
            if match.lastindex and match.group(1):
                role = match.group(1).strip()
                logger.debug(f"          Role extracted using pattern {pattern_idx + 1}: {role}")
                return role
            else:
                role = match.group(0).strip()
                logger.debug(f"          Role extracted using pattern {pattern_idx + 1}: {role}")
                return role
    
    # Fallback to first position
    fallback_role = positions[0] if positions else "Unknown Role"
    logger.debug(f"          Role not found in snippet/title, using fallback: {fallback_role}")
    return fallback_role


@app.post("/api/search-linkedin", response_model=LinkedInSearchResponse)
async def search_linkedin(
    request: LinkedInSearchRequest,
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """
    Search LinkedIn profiles using Google Custom Search API and save to database
    
    Based on ConneXion for LinkedIn approach: https://github.com/ethbak/connexion-for-linkedin
    - Uses Google Custom Search JSON API to find LinkedIn profiles
    - Receives filter data from UI fields (locations, positions, experience)
    - Instead of writing to Excel (as ConneXion does), writes directly to Supabase database
    - All logging is written to console/CMD for debugging
    """
    
    logger.info("=" * 60)
    logger.info("LinkedIn Search Request Received")
    logger.info("=" * 60)
    logger.info(f"Stage 1: Request received - locations={request.locations}, positions={request.positions}, tenant_id={request.tenant_id}, limit={request.limit}")
    
    # Verify tenant_id matches
    logger.info(f"Stage 2: Verifying tenant_id match...")
    if request.tenant_id != user_info["tenant_id"]:
        logger.error(f"Tenant ID mismatch: request={request.tenant_id}, user={user_info['tenant_id']}")
        raise HTTPException(status_code=403, detail="Tenant ID mismatch")
    logger.info(f"Stage 2: ✅ Tenant ID verified: {request.tenant_id}")
    
    # Validate inputs
    logger.info(f"Stage 3: Validating inputs...")
    if not request.locations or len(request.locations) == 0:
        logger.error("Stage 3: ❌ Validation failed - no locations provided")
        raise HTTPException(status_code=400, detail="At least one location is required")
    
    if not request.positions or len(request.positions) == 0:
        logger.error("Stage 3: ❌ Validation failed - no positions provided")
        raise HTTPException(status_code=400, detail="At least one position is required")
    
    if request.experience_operator not in [">", "<", "="]:
        logger.error(f"Stage 3: ❌ Validation failed - invalid experience_operator: {request.experience_operator}")
        raise HTTPException(status_code=400, detail="experience_operator must be '>', '<', or '='")
    
    if request.experience_years < 0 or request.experience_years > 30:
        logger.error(f"Stage 3: ❌ Validation failed - invalid experience_years: {request.experience_years}")
        raise HTTPException(status_code=400, detail="experience_years must be between 0 and 30")
    
    logger.info(f"Stage 3: ✅ Input validation passed")
    
    try:
        # Search LinkedIn profiles
        logger.info(f"Stage 4: Starting LinkedIn profile search...")
        profiles = search_linkedin_profiles(
            locations=request.locations,
            positions=request.positions,
            experience_operator=request.experience_operator,
            experience_years=request.experience_years,
            limit=request.limit
        )
        logger.info(f"Stage 4: ✅ Profile search completed. Found {len(profiles)} profiles")
        
        # Prepare leads for insertion
        logger.info(f"Stage 5: Preparing leads for database insertion...")
        leads_to_insert = []
        for idx, profile in enumerate(profiles):
            lead_data = {
                "tenant_id": request.tenant_id,
                "contact_person": profile["name"],
                "company_name": profile["company"],
                "role": profile["role"],
                "contact_email": "",  # LinkedIn profiles don't provide email
                "status": "not_contacted",
            }
            # Only include tier if the column exists (it has a default value of 1 anyway)
            # This prevents errors if the migration hasn't been applied yet
            leads_to_insert.append(lead_data)
            logger.info(f"  Prepared lead {idx + 1}/{len(profiles)}: {profile['name']} at {profile['company']}")
        
        logger.info(f"Stage 5: ✅ Prepared {len(leads_to_insert)} leads for insertion")
        
        # Insert leads into Supabase
        logger.info(f"Stage 6: Inserting leads into Supabase database...")
        if leads_to_insert:
            logger.info(f"  Attempting to insert {len(leads_to_insert)} leads...")
            logger.info(f"  Lead data structure: {list(leads_to_insert[0].keys()) if leads_to_insert else 'empty'}")
            
            try:
                result = supabase.table("leads").insert(leads_to_insert).execute()
                leads_created = len(result.data) if result.data else 0
                logger.info(f"Stage 6: ✅ Successfully inserted {leads_created} leads into database")
            except PostgrestAPIError as e:
                error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
                error_code = error_dict.get('code', '')
                error_message = error_dict.get('message', str(e))
                
                logger.error(f"Stage 6: ❌ Database insertion failed")
                logger.error(f"  Error Code: {error_code}")
                logger.error(f"  Error Message: {error_message}")
                
                # Check if it's a missing column error
                if 'tier' in error_message.lower() or error_code == 'PGRST204':
                    logger.error("")
                    logger.error("=" * 60)
                    logger.error("MISSING COLUMN ERROR: 'tier' column not found")
                    logger.error("=" * 60)
                    logger.error("The 'tier' column doesn't exist in your 'leads' table.")
                    logger.error("")
                    logger.error("To fix this, run the migration:")
                    logger.error("  supabase/migrations/20240101000000_add_tier_to_leads.sql")
                    logger.error("")
                    logger.error("Or manually execute:")
                    logger.error("  ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;")
                    logger.error("=" * 60)
                    logger.error("")
                
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_message}. Check logs for details."
                )
        else:
            leads_created = 0
            logger.warning(f"Stage 6: ⚠️  No leads to insert")
        
        logger.info(f"Stage 7: Preparing response...")
        response = LinkedInSearchResponse(
            success=True,
            profiles_found=len(profiles),
            leads_created=leads_created
        )
        logger.info(f"Stage 7: ✅ Response prepared - success=True, profiles_found={len(profiles)}, leads_created={leads_created}")
        logger.info("=" * 60)
        logger.info("LinkedIn Search Request Completed Successfully")
        logger.info("=" * 60)
        return response
        
    except HTTPException:
        logger.error("Stage X: HTTPException raised, re-raising...")
        raise
    except Exception as e:
        logger.error("=" * 60)
        logger.error("LinkedIn Search Request Failed")
        logger.error("=" * 60)
        logger.error(f"Stage X: ❌ Error in search_linkedin: {e}", exc_info=True)
        response = LinkedInSearchResponse(
            success=False,
            profiles_found=0,
            leads_created=0,
            error=str(e)
        )
        logger.error(f"Returning error response: {response}")
        return response


@app.options("/api/search-linkedin")
async def options_search_linkedin():
    """Handle CORS preflight for search-linkedin endpoint"""
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

