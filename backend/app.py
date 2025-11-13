from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from datetime import datetime, timedelta
import secrets
import urllib.parse
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from postgrest.exceptions import APIError as PostgrestAPIError
import logging

from services.linkedin_search import LinkedInSearchService
from services.google_places_service import GooglePlacesService
from services.llm_service import LLMService
from services.google_custom_search_service import GoogleCustomSearchService
from services.database_service import DatabaseService
from services.workflow_orchestrator import WorkflowOrchestrator

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# CORS middleware
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
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL must be set in environment variables")

if not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.\n"
        "This should be the SERVICE_ROLE key (secret), not the ANON key (publishable)."
    )

if not SUPABASE_ANON_KEY:
    raise ValueError(
        "SUPABASE_ANON_KEY must be set in environment variables.\n"
        "This is needed for user authentication verification."
    )

# Service role client for database operations (bypasses RLS)
# According to Supabase Python docs: https://supabase.com/docs/reference/python/introduction
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )
)

# Anon key client for auth operations (validates user sessions properly)
supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Initialize LinkedIn Search Service
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY_ForSearchLinkedIn")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY_ForSearchLinkedIn environment variable is required")

if not GOOGLE_CSE_ID:
    raise ValueError("GOOGLE_CSE_ID environment variable is required")

linkedin_search_service = LinkedInSearchService(GOOGLE_API_KEY, GOOGLE_CSE_ID)

# Initialize Google Places API Service
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
google_places_service = GooglePlacesService(GOOGLE_PLACES_API_KEY) if GOOGLE_PLACES_API_KEY else None

# Initialize LLM Service
llm_service = LLMService()

# Initialize Google Custom Search Service (general purpose)
google_custom_search_service = GoogleCustomSearchService(GOOGLE_API_KEY, GOOGLE_CSE_ID)

# Initialize Database Service
database_service = DatabaseService(supabase)

# Initialize Workflow Orchestrator
workflow_orchestrator = WorkflowOrchestrator(
    google_places_service=google_places_service,
    llm_service=llm_service,
    google_custom_search_service=google_custom_search_service,
    linkedin_search_service=linkedin_search_service,
    database_service=database_service
)

# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")

# LinkedIn OAuth URLs
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
# LinkedIn OpenID Connect userinfo endpoint
LINKEDIN_PROFILE_API = "https://api.linkedin.com/v2/userinfo"
# Alternative: LinkedIn REST API v2 endpoint (if OpenID Connect doesn't work)
LINKEDIN_REST_API = "https://api.linkedin.com/v2/me"

# Store OAuth state temporarily (in production, use Redis or database)
oauth_states = {}

# Request/Response Models
class LinkedInConnectRequest(BaseModel):
    user_id: str
    redirect_uri: str

class LinkedInConnectResponse(BaseModel):
    auth_url: str
    state: str

class LinkedInCallbackRequest(BaseModel):
    code: str
    state: str
    user_id: str

class LinkedInCallbackResponse(BaseModel):
    success: bool
    error: Optional[str] = None

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

class SavePreferencesRequest(BaseModel):
    tenant_id: str
    # General preferences
    target_industry: Optional[str] = None
    company_size: Optional[str] = None
    locations: Optional[str] = None
    target_positions: Optional[str] = None
    revenue_range: Optional[str] = None
    keywords: Optional[str] = None
    notes: Optional[str] = None
    experience_operator: Optional[str] = "="
    experience_years: Optional[int] = 0
    company_type: Optional[str] = None
    technology_stack: Optional[str] = None
    funding_stage: Optional[str] = None

class SavePreferencesResponse(BaseModel):
    success: bool
    error: Optional[str] = None

class GetPreferencesResponse(BaseModel):
    success: bool
    preferences: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class GenerateLeadsRequest(BaseModel):
    tenant_id: str

class GenerateLeadsResponse(BaseModel):
    success: bool
    leads_created: int
    error: Optional[str] = None

# Authentication
def verify_auth(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token and return user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    try:
        # Use anon key client for auth verification (validates user sessions properly)
        response = supabase_auth.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Use service role client for database queries (bypasses RLS)
        profile_result = supabase.table("user_profiles").select("tenant_id").eq("id", response.user.id).limit(1).execute()
        
        if not profile_result.data or len(profile_result.data) == 0:
            raise HTTPException(
                status_code=404,
                detail="User profile not found. Please complete your profile setup in the application."
            )
        
        tenant_id = profile_result.data[0].get("tenant_id")
        
        if not tenant_id:
            raise HTTPException(status_code=404, detail="User tenant not found. Please contact support.")
        
        return {
            "user_id": response.user.id,
            "tenant_id": tenant_id
        }
    except HTTPException:
        raise
    except PostgrestAPIError as e:
        error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
        if error_dict.get('code') == 'PGRST116':
            raise HTTPException(
                status_code=404,
                detail="User profile not found. Please complete your profile setup in the application."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def verify_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token and check if user is admin"""
    user_info = verify_auth(authorization)
    
    try:
        # Check if user is admin
        profile_result = supabase.table("user_profiles").select("is_admin").eq("id", user_info["user_id"]).single().execute()
        
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        is_admin = profile_result.data.get("is_admin", False)
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return user_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin verification error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Admin verification failed: {str(e)}")

@app.post("/api/linkedin/connect", response_model=LinkedInConnectResponse)
async def connect_linkedin(
    request: LinkedInConnectRequest,
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """Initiate LinkedIn OAuth flow"""
    
    # Verify user_id matches
    if request.user_id != user_info["user_id"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
    
    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LinkedIn OAuth is not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables."
        )
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": request.user_id,
        "redirect_uri": request.redirect_uri,
        "created_at": datetime.utcnow()
    }
    
    # Build authorization URL
    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": request.redirect_uri,
        "state": state,
        "scope": "openid profile email"  # Request basic profile info
    }
    
    auth_url = f"{LINKEDIN_AUTH_URL}?{urllib.parse.urlencode(params)}"
    
    return LinkedInConnectResponse(
        auth_url=auth_url,
        state=state
    )

@app.post("/api/linkedin/callback", response_model=LinkedInCallbackResponse)
async def linkedin_callback(
    request: LinkedInCallbackRequest,
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """Handle LinkedIn OAuth callback"""
    
    # Verify user_id matches
    if request.user_id != user_info["user_id"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
    
    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LinkedIn OAuth is not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables."
        )
    
    # Verify state
    if request.state not in oauth_states:
        return LinkedInCallbackResponse(
            success=False,
            error="Invalid or expired state parameter"
        )
    
    state_data = oauth_states[request.state]
    
    # Verify state belongs to this user
    if state_data["user_id"] != request.user_id:
        return LinkedInCallbackResponse(
            success=False,
            error="State mismatch"
        )
    
    # Clean up state (one-time use)
    del oauth_states[request.state]
    
    try:
        # Exchange authorization code for access token
        token_data = {
            "grant_type": "authorization_code",
            "code": request.code,
            "redirect_uri": state_data["redirect_uri"],
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET
        }
        
        token_response = requests.post(
            LINKEDIN_TOKEN_URL,
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if token_response.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {token_response.text}")
            return LinkedInCallbackResponse(
                success=False,
                error=f"Failed to exchange authorization code: {token_response.text}"
            )
        
        token_json = token_response.json()
        access_token = token_json.get("access_token")
        expires_in = token_json.get("expires_in", 3600)  # Default to 1 hour
        refresh_token = token_json.get("refresh_token")
        
        if not access_token:
            return LinkedInCallbackResponse(
                success=False,
                error="No access token received from LinkedIn"
            )
        
        # Fetch user profile from LinkedIn
        # Try OpenID Connect endpoint first
        profile_response = requests.get(
            LINKEDIN_PROFILE_API,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
        )
        
        # If OpenID Connect fails, try REST API v2
        if profile_response.status_code != 200:
            logger.warning(f"OpenID Connect endpoint failed, trying REST API: {profile_response.text}")
            profile_response = requests.get(
                LINKEDIN_REST_API,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
            )
        
        if profile_response.status_code != 200:
            logger.error(f"LinkedIn profile fetch failed: {profile_response.text}")
            return LinkedInCallbackResponse(
                success=False,
                error=f"Failed to fetch LinkedIn profile: {profile_response.text}"
            )
        
        profile_data = profile_response.json()
        
        # Extract profile information (handle both OpenID Connect and REST API formats)
        linkedin_profile_id = profile_data.get("sub") or profile_data.get("id")
        linkedin_first_name = (
            profile_data.get("given_name") or 
            profile_data.get("firstName", {}).get("localized", {}).get("en_US") or
            profile_data.get("firstName")
        )
        linkedin_last_name = (
            profile_data.get("family_name") or 
            profile_data.get("lastName", {}).get("localized", {}).get("en_US") or
            profile_data.get("lastName")
        )
        linkedin_email = profile_data.get("email")
        
        # Build profile URL - LinkedIn uses numeric IDs or vanity URLs
        linkedin_profile_url = None
        if linkedin_profile_id:
            # Try to get vanity name from profile, otherwise use ID
            vanity_name = profile_data.get("vanityName") or profile_data.get("vanity_name")
            if vanity_name:
                linkedin_profile_url = f"https://www.linkedin.com/in/{vanity_name}"
            else:
                linkedin_profile_url = f"https://www.linkedin.com/in/{linkedin_profile_id}"
        
        # Calculate token expiration
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Update user profile with LinkedIn data
        update_data = {
            "linkedin_access_token": access_token,
            "linkedin_refresh_token": refresh_token,
            "linkedin_profile_id": linkedin_profile_id,
            "linkedin_profile_url": linkedin_profile_url,
            "linkedin_first_name": linkedin_first_name,
            "linkedin_last_name": linkedin_last_name,
            "linkedin_headline": profile_data.get("headline") or None,
            "linkedin_connected_at": datetime.utcnow().isoformat(),
            "linkedin_token_expires_at": token_expires_at.isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = supabase.table("user_profiles").update(update_data).eq("id", request.user_id).execute()
        
        if not result.data:
            return LinkedInCallbackResponse(
                success=False,
                error="Failed to update user profile"
            )
        
        logger.info(f"LinkedIn account connected for user {request.user_id}")
        
        return LinkedInCallbackResponse(success=True)
        
    except Exception as e:
        logger.error(f"Error in LinkedIn callback: {e}", exc_info=True)
        return LinkedInCallbackResponse(
            success=False,
            error=str(e)
        )

# API Endpoints
@app.post("/api/search-linkedin", response_model=LinkedInSearchResponse)
async def search_linkedin(
    request: LinkedInSearchRequest,
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """Search LinkedIn profiles and save to database"""
    
    # Verify tenant_id matches
    if request.tenant_id != user_info["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant ID mismatch")
    
    # Validate inputs
    if not request.locations or len(request.locations) == 0:
        raise HTTPException(status_code=400, detail="At least one location is required")
    
    if not request.positions or len(request.positions) == 0:
        raise HTTPException(status_code=400, detail="At least one position is required")
    
    if request.experience_operator not in [">", "<", "="]:
        raise HTTPException(status_code=400, detail="experience_operator must be '>', '<', or '='")
    
    if request.experience_years < 0 or request.experience_years > 30:
        raise HTTPException(status_code=400, detail="experience_years must be between 0 and 30")
    
    try:
        # Search LinkedIn profiles
        profiles = linkedin_search_service.search_profiles(
            locations=request.locations,
            positions=request.positions,
            experience_operator=request.experience_operator,
            experience_years=request.experience_years,
            limit=request.limit
        )
        
        # Prepare leads for insertion
        leads_to_insert = []
        for profile in profiles:
            leads_to_insert.append({
                "tenant_id": request.tenant_id,
                "contact_person": profile["name"],
                "company_name": profile["company"],
                "role": profile["role"],
                "contact_email": "",
                "status": "not_contacted",
            })
        
        # Insert leads into Supabase
        if leads_to_insert:
            try:
                result = supabase.table("leads").insert(leads_to_insert).execute()
                leads_created = len(result.data) if result.data else 0
            except PostgrestAPIError as e:
                error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
                error_message = error_dict.get('message', str(e))
                logger.error(f"Database insertion failed: {error_message}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_message}"
                )
        else:
            leads_created = 0
        
        return LinkedInSearchResponse(
            success=True,
            profiles_found=len(profiles),
            leads_created=leads_created
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in search_linkedin: {e}", exc_info=True)
        return LinkedInSearchResponse(
            success=False,
            profiles_found=0,
            leads_created=0,
            error=str(e)
        )

@app.get("/api/get-preferences", response_model=GetPreferencesResponse)
async def get_preferences(
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """Get tenant preferences"""
    
    try:
        # Use service role client to bypass RLS (already initialized at module level)
        result = supabase.table("tenant_preferences").select("*").eq("tenant_id", user_info["tenant_id"]).execute()
        
        if result.data and len(result.data) > 0:
            return GetPreferencesResponse(
                success=True,
                preferences=result.data[0]
            )
        else:
            # Return empty preferences if none exist
            return GetPreferencesResponse(
                success=True,
                preferences={}
            )
        
    except Exception as e:
        logger.error(f"Error getting preferences: {e}", exc_info=True)
        return GetPreferencesResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/save-preferences", response_model=SavePreferencesResponse)
async def save_preferences(
    request: SavePreferencesRequest,
    user_info: Dict[str, Any] = Depends(verify_auth)
):
    """Save tenant preferences"""
    
    # Verify tenant_id matches
    if request.tenant_id != user_info["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant ID mismatch")
    
    # Validate inputs
    if request.experience_operator and request.experience_operator not in [">", "<", "="]:
        raise HTTPException(status_code=400, detail="experience_operator must be '>', '<', or '='")
    
    if request.experience_years is not None and (request.experience_years < 0 or request.experience_years > 30):
        raise HTTPException(status_code=400, detail="experience_years must be between 0 and 30")
    
    try:
        # Build update data (only include fields that are provided)
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Add general preferences if provided
        if request.target_industry is not None:
            update_data["target_industry"] = request.target_industry
        if request.company_size is not None:
            update_data["company_size"] = request.company_size
        if request.locations is not None:
            update_data["locations"] = request.locations
        if request.target_positions is not None:
            update_data["target_positions"] = request.target_positions
        if request.revenue_range is not None:
            update_data["revenue_range"] = request.revenue_range
        if request.keywords is not None:
            update_data["keywords"] = request.keywords
        if request.notes is not None:
            update_data["notes"] = request.notes
        
        # Add consolidated experience fields if provided
        if request.experience_operator is not None:
            update_data["experience_operator"] = request.experience_operator
        if request.experience_years is not None:
            update_data["experience_years"] = request.experience_years
        
        # Add new fields if provided
        if request.company_type is not None:
            update_data["company_type"] = request.company_type
        if request.technology_stack is not None:
            update_data["technology_stack"] = request.technology_stack
        if request.funding_stage is not None:
            update_data["funding_stage"] = request.funding_stage
        
        # Check if preferences record exists using Supabase client
        # Verify we're using service role by checking the key format
        if not SUPABASE_SERVICE_KEY.startswith('eyJ'):
            logger.error("CRITICAL: Service role key format is incorrect! It should start with 'eyJ'")
            raise HTTPException(status_code=500, detail="Service role key configuration error")
        
        # Check if preferences exist
        existing_result = supabase.table("tenant_preferences").select("id").eq("tenant_id", request.tenant_id).execute()
        existing_data = existing_result.data if existing_result.data else []
        
        if existing_data and len(existing_data) > 0:
            # Update existing preferences
            # Service role key bypasses RLS automatically
            result = supabase.table("tenant_preferences").update(update_data).eq("tenant_id", request.tenant_id).execute()
        else:
            # Insert new preferences
            # Service role key bypasses RLS automatically
            update_data["tenant_id"] = request.tenant_id
            logger.info(f"Attempting to insert preferences for tenant_id: {request.tenant_id}")
            result = supabase.table("tenant_preferences").insert(update_data).execute()
            logger.info(f"Insert result: {result.data if result.data else 'No data returned'}")
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save preferences")
        
        return SavePreferencesResponse(success=True)
        
    except HTTPException:
        raise
    except PostgrestAPIError as e:
        error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
        error_code = error_dict.get('code', 'UNKNOWN')
        error_message = error_dict.get('message', str(e))
        
        logger.error(f"PostgREST error saving preferences: {error_code} - {error_message}")
        logger.error(f"Service role key configured: {SUPABASE_SERVICE_KEY[:20] if SUPABASE_SERVICE_KEY else 'NOT SET'}...")
        
        if error_code == '42501':
            return SavePreferencesResponse(
                success=False,
                error=f"Permission denied. Service role key may not be configured correctly. Error: {error_message}"
            )
        
        return SavePreferencesResponse(
            success=False,
            error=f"Database error ({error_code}): {error_message}"
        )
    except Exception as e:
        logger.error(f"Error saving preferences: {e}", exc_info=True)
        logger.error(f"Service role key configured: {SUPABASE_SERVICE_KEY[:20] if SUPABASE_SERVICE_KEY else 'NOT SET'}...")
        return SavePreferencesResponse(
            success=False,
            error=str(e)
        )

@app.options("/api/linkedin/connect")
async def options_linkedin_connect():
    """Handle CORS preflight for linkedin/connect endpoint"""
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

@app.options("/api/linkedin/callback")
async def options_linkedin_callback():
    """Handle CORS preflight for linkedin/callback endpoint"""
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

@app.options("/api/save-preferences")
async def options_save_preferences():
    """Handle CORS preflight for save-preferences endpoint"""
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

@app.options("/api/get-preferences")
async def options_get_preferences():
    """Handle CORS preflight for get-preferences endpoint"""
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

# Admin Endpoints
@app.post("/api/admin/generate-leads", response_model=GenerateLeadsResponse)
async def generate_leads(
    request: GenerateLeadsRequest,
    user_info: Dict[str, Any] = Depends(verify_admin)
):
    """Generate leads for a tenant based on their preferences and method using agentic workflow"""
    try:
        # Get tenant preferences using Supabase client
        prefs_result = supabase.table("tenant_preferences").select("*").eq("tenant_id", request.tenant_id).execute()
        
        if not prefs_result.data or len(prefs_result.data) == 0:
            return GenerateLeadsResponse(
                success=False,
                leads_created=0,
                error=f"Tenant preferences not found for tenant {request.tenant_id}. Please configure preferences first in Settings, or ensure lead generation methods are selected in the Admin Dashboard."
            )
        
        preferences = prefs_result.data[0]
        lead_generation_methods = preferences.get("lead_generation_method")
        
        if not lead_generation_methods or not isinstance(lead_generation_methods, list) or len(lead_generation_methods) == 0:
            return GenerateLeadsResponse(
                success=False,
                leads_created=0,
                error="Lead generation methods not set for this tenant. Please select at least one method in the Admin Dashboard first."
            )
        
        # Use workflow orchestrator to generate leads
        
        result = workflow_orchestrator.generate_leads(
            methods=lead_generation_methods,
            preferences=preferences,  # Pass full preferences JSON object
            tenant_id=request.tenant_id,
            max_results_per_method=50
        )
        
        # Build error message if any
        error_msg = None
        if result.get("errors"):
            error_msg = "; ".join(result["errors"])
        
        return GenerateLeadsResponse(
            success=result["success"],
            leads_created=result["leads_created"],
            error=error_msg
        )
        
    except Exception as e:
        logger.error(f"Error generating leads: {e}", exc_info=True)
        return GenerateLeadsResponse(
            success=False,
            leads_created=0,
            error=str(e)
        )

@app.options("/api/admin/generate-leads")
async def options_admin_generate_leads():
    """Handle CORS preflight for admin generate leads endpoint"""
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
