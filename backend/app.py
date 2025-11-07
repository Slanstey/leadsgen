from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError as PostgrestAPIError
from postgrest import SyncPostgrestClient
import logging

from services.linkedin_search import LinkedInSearchService

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

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL must be set in environment variables")

if not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.\n"
        "This should be the SERVICE_ROLE key (secret), not the ANON key (publishable)."
    )

# Initialize Supabase client with service role key
# Service role key bypasses RLS automatically
# Verify the key format (service role keys start with 'eyJ' and are JWT tokens)
if not SUPABASE_SERVICE_KEY.startswith('eyJ'):
    logger.warning("WARNING: SUPABASE_SERVICE_ROLE_KEY doesn't look like a service role key (should start with 'eyJ')")
    logger.warning("Make sure you're using the SERVICE_ROLE key, not the ANON key")

# Initialize Supabase client with service role key
# Service role key bypasses RLS automatically
# Note: We'll create a separate client for auth operations vs table operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Log that we're using service role (for debugging)
logger.info(f"Supabase client initialized with service role key (RLS bypass enabled)")
logger.info(f"Service role key starts with: {SUPABASE_SERVICE_KEY[:10]}...")

# Initialize LinkedIn Search Service
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY_ForSearchLinkedIn")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY_ForSearchLinkedIn environment variable is required")

if not GOOGLE_CSE_ID:
    raise ValueError("GOOGLE_CSE_ID environment variable is required")

linkedin_search_service = LinkedInSearchService(GOOGLE_API_KEY, GOOGLE_CSE_ID)

# Request/Response Models
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
    geographic_region: Optional[str] = None
    target_roles: Optional[str] = None
    revenue_range: Optional[str] = None
    keywords: Optional[str] = None
    notes: Optional[str] = None
    # LinkedIn preferences
    linkedin_locations: Optional[str] = None
    linkedin_positions: Optional[str] = None
    linkedin_experience_operator: Optional[str] = "="
    linkedin_experience_years: Optional[int] = 0

class SavePreferencesResponse(BaseModel):
    success: bool
    error: Optional[str] = None

class GetPreferencesResponse(BaseModel):
    success: bool
    preferences: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Authentication
def verify_auth(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token and return user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    try:
        response = supabase.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
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
        # Use service role client to bypass RLS
        service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = service_client.table("tenant_preferences").select("*").eq("tenant_id", user_info["tenant_id"]).execute()
        
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
    if request.linkedin_experience_operator and request.linkedin_experience_operator not in [">", "<", "="]:
        raise HTTPException(status_code=400, detail="experience_operator must be '>', '<', or '='")
    
    if request.linkedin_experience_years is not None and (request.linkedin_experience_years < 0 or request.linkedin_experience_years > 30):
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
        if request.geographic_region is not None:
            update_data["geographic_region"] = request.geographic_region
        if request.target_roles is not None:
            update_data["target_roles"] = request.target_roles
        if request.revenue_range is not None:
            update_data["revenue_range"] = request.revenue_range
        if request.keywords is not None:
            update_data["keywords"] = request.keywords
        if request.notes is not None:
            update_data["notes"] = request.notes
        
        # Add LinkedIn preferences if provided
        if request.linkedin_locations is not None:
            update_data["linkedin_locations"] = request.linkedin_locations
        if request.linkedin_positions is not None:
            update_data["linkedin_positions"] = request.linkedin_positions
        if request.linkedin_experience_operator is not None:
            update_data["linkedin_experience_operator"] = request.linkedin_experience_operator
        if request.linkedin_experience_years is not None:
            update_data["linkedin_experience_years"] = request.linkedin_experience_years
        
        # Check if preferences record exists
        # Use PostgREST client directly with service role key to ensure RLS bypass
        # The service role key MUST be sent as both apikey header and Authorization Bearer token
        postgrest_client = SyncPostgrestClient(
            base_url=f"{SUPABASE_URL}/rest/v1",
            schema="public",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            }
        )
        
        # Verify we're using service role by checking the key format
        if not SUPABASE_SERVICE_KEY.startswith('eyJ'):
            logger.error("CRITICAL: Service role key format is incorrect! It should start with 'eyJ'")
            raise HTTPException(status_code=500, detail="Service role key configuration error")
        
        # Check if preferences exist
        existing_response = postgrest_client.from_("tenant_preferences").select("id").eq("tenant_id", request.tenant_id).execute()
        existing_data = existing_response.data if hasattr(existing_response, 'data') else []
        
        if existing_data and len(existing_data) > 0:
            # Update existing preferences
            # Service role key bypasses RLS automatically
            result_response = postgrest_client.from_("tenant_preferences").update(update_data).eq("tenant_id", request.tenant_id).execute()
            result = result_response.data if hasattr(result_response, 'data') else []
        else:
            # Insert new preferences
            # Service role key bypasses RLS automatically
            update_data["tenant_id"] = request.tenant_id
            logger.info(f"Attempting to insert preferences for tenant_id: {request.tenant_id}")
            result_response = postgrest_client.from_("tenant_preferences").insert(update_data).execute()
            result = result_response.data if hasattr(result_response, 'data') else []
            logger.info(f"Insert result: {result}")
        
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

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
