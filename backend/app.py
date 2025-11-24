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
llm_service = LLMService()
database_service = DatabaseService(supabase, llm_service)

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
    tenant_id: Optional[str] = None
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

class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: Optional[str] = None

class SignUpResponse(BaseModel):
    success: bool
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
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
        
        # All users now have a tenant_id (private users get a private tenant created automatically)
        
        return {
            "user_id": response.user.id,
            "tenant_id": tenant_id  # Always present now (private users have private tenants)
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
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    try:
        # Use anon key client for auth verification (validates user sessions properly)
        response = supabase_auth.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Use service role client for database queries (bypasses RLS)
        profile_result = supabase.table("user_profiles").select("is_admin, tenant_id").eq("id", response.user.id).single().execute()
        
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        is_admin = profile_result.data.get("is_admin", False)
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Return user info with tenant_id (may be None for admins, which is fine)
        return {
            "user_id": response.user.id,
            "tenant_id": profile_result.data.get("tenant_id")  # May be None for admins
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
        logger.error(f"Admin verification error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Admin verification failed: {str(e)}")

def verify_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token and return user info without requiring tenant_id"""
    logger.debug("[verify_user] Starting user verification")
    
    if not authorization:
        logger.warning("[verify_user] Authorization header missing")
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    logger.debug(f"[verify_user] Token extracted - length: {len(token)}")
    
    try:
        # Use anon key client for auth verification (validates user sessions properly)
        logger.debug("[verify_user] Calling supabase_auth.auth.get_user")
        response = supabase_auth.auth.get_user(token)
        
        if not response.user:
            logger.warning("[verify_user] Supabase auth.get_user returned no user")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        logger.info(f"[verify_user] User authenticated - user_id: {response.user.id}")
        
        # Use service role client for database queries (bypasses RLS)
        logger.debug(f"[verify_user] Fetching user profile from database - user_id: {response.user.id}")
        profile_result = supabase.table("user_profiles").select("tenant_id").eq("id", response.user.id).limit(1).execute()
        
        if not profile_result.data or len(profile_result.data) == 0:
            logger.error(f"[verify_user] User profile not found in database - user_id: {response.user.id}")
            raise HTTPException(
                status_code=404,
                detail="User profile not found. Please complete your profile setup in the application."
            )
        
        tenant_id = profile_result.data[0].get("tenant_id")
        logger.info(f"[verify_user] User profile found - user_id: {response.user.id}, tenant_id: {tenant_id}")
        
        # Return user info with tenant_id (may be None, which is fine for LinkedIn connection)
        return {
            "user_id": response.user.id,
            "tenant_id": tenant_id  # May be None
        }
    except HTTPException:
        raise
    except PostgrestAPIError as e:
        error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
        logger.error(f"[verify_user] PostgrestAPIError: {error_dict}")
        if error_dict.get('code') == 'PGRST116':
            raise HTTPException(
                status_code=404,
                detail="User profile not found. Please complete your profile setup in the application."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"[verify_user] User verification error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@app.post("/api/signup", response_model=SignUpResponse)
async def signup(request: SignUpRequest):
    """Handle user signup with automatic tenant assignment or private tenant creation
    
    This endpoint:
    1. Checks if user already exists (by email) - returns error if exists
    2. Creates the user via Supabase Auth
    3. Checks if email domain matches existing tenant domain -> assigns that tenant
    4. If no match -> creates a private tenant (never creates domain-based tenants)
    5. Creates user_profile with assigned tenant_id
    
    Uses service role key to bypass RLS for tenant and profile creation.
    """
    tenant_id = None
    user_id = None
    
    try:
        # Step 0: Check if user already exists (by email in user_profiles or auth)
        existing_profile = supabase.table("user_profiles").select("id, email").eq("email", request.email).limit(1).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            logger.warning(f"Signup attempted for existing user: {request.email}")
            return SignUpResponse(
                success=False,
                error="A user with this email address already exists. Please sign in instead."
            )
        
        # Step 1: Create user via Supabase Auth (using anon key client)
        # Note: sign_up will return an error if user already exists
        try:
            auth_response = supabase_auth.auth.sign_up({
                "email": request.email,
                "password": request.password,
                "options": {
                    "data": {
                        "full_name": request.full_name,
                        "organization_name": request.organization_name or "",
                    }
                }
            })
        except Exception as auth_error:
            # Check if error indicates user already exists
            error_str = str(auth_error).lower()
            if "already registered" in error_str or "already exists" in error_str or "user already" in error_str:
                logger.warning(f"Signup attempted for existing auth user: {request.email}")
                return SignUpResponse(
                    success=False,
                    error="A user with this email address already exists. Please sign in instead."
                )
            # Re-raise other auth errors
            raise
        
        if auth_response.user is None:
            # Check for error in response
            error_msg = "Failed to create user account"
            if hasattr(auth_response, 'session') and auth_response.session:
                if hasattr(auth_response.session, 'error'):
                    error_msg = str(auth_response.session.error)
                elif hasattr(auth_response.session, 'user') and auth_response.session.user is None:
                    # User creation failed
                    error_msg = "Failed to create user account. The email may already be registered."
            
            # Also check if there's an error attribute
            if hasattr(auth_response, 'error') and auth_response.error:
                error_msg = str(auth_response.error)
            
            return SignUpResponse(
                success=False,
                error=error_msg
            )
        
        user_id = auth_response.user.id
        
        # Step 1.5: Check if user_profile already exists (might be created by trigger)
        # IMPORTANT: Check BEFORE creating tenant to avoid orphaned tenants
        existing_profile_by_id = supabase.table("user_profiles").select("id, email, tenant_id").eq("id", user_id).limit(1).execute()
        
        if existing_profile_by_id.data and len(existing_profile_by_id.data) > 0:
            # Profile already exists - check if it's the same email
            existing_email = existing_profile_by_id.data[0].get("email")
            existing_tenant_id = existing_profile_by_id.data[0].get("tenant_id")
            
            if existing_email and existing_email.lower() != request.email.lower():
                logger.warning(f"User {user_id} already exists with different email: {existing_email}")
                return SignUpResponse(
                    success=False,
                    error="A user with this email address already exists. Please sign in instead."
                )
            
            # If profile exists and has tenant_id, use that tenant (don't create new one)
            if existing_tenant_id:
                logger.info(f"User profile already exists for {user_id} with tenant {existing_tenant_id}, updating info only")
                # Just update the profile with latest info
                update_result = supabase.table("user_profiles").update({
                    "email": request.email,
                    "full_name": request.full_name,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", user_id).execute()
                
                if update_result.data:
                    return SignUpResponse(
                        success=True,
                        user_id=user_id,
                        tenant_id=existing_tenant_id
                    )
                else:
                    return SignUpResponse(
                        success=False,
                        error="Failed to update existing user profile"
                    )
            
            # Profile exists but no tenant_id - we'll create/assign tenant below
            logger.info(f"User profile already exists for {user_id} without tenant, will assign tenant")
        
        # Step 2: Determine tenant assignment
        # ANY user without matching domain gets private tenant (not just generic email providers)
        email_domain = request.email.split('@')[1].lower() if '@' in request.email else None
        tenant_id = None
        
        if email_domain:
            # Check if a tenant exists with matching domain (using service role, bypasses RLS)
            tenant_result = supabase.table("tenants").select("id, name").eq("domain", email_domain).limit(1).execute()
            
            if tenant_result.data and len(tenant_result.data) > 0:
                # Assign user to existing tenant (only if domain matches)
                tenant_id = tenant_result.data[0]["id"]
                tenant_name = tenant_result.data[0].get("name", "Unknown")
                logger.info(f"Assigned user {user_id} to existing tenant {tenant_id} (domain: {email_domain}, name: {tenant_name})")
            else:
                # No matching tenant - will create private tenant below
                logger.info(f"No tenant found for domain {email_domain}, will create private tenant")
        
        # Step 3: Create private tenant if no matching tenant found
        if not tenant_id:
            # Generate unique slug for private tenant using full email address
            # Convert email to slug format: user@example.com -> user_example_com_privateTenant
            email_slug = request.email.lower().replace('@', '_').replace('.', '_')
            # Remove any other non-alphanumeric characters except underscore
            email_slug = ''.join(c if c.isalnum() or c == '_' else '_' for c in email_slug)
            # Remove multiple underscores
            email_slug = '_'.join(filter(None, email_slug.split('_')))
            base_slug = f"{email_slug}_privateTenant"
            
            # Find unique slug
            tenant_slug = base_slug
            counter = 0
            while True:
                existing = supabase.table("tenants").select("id").eq("slug", tenant_slug).limit(1).execute()
                if not existing.data or len(existing.data) == 0:
                    break
                counter += 1
                tenant_slug = f"{base_slug}_{counter}"
            
            # Create private tenant name using full email address - MUST use request.email
            tenant_name = f"{request.email} (Private Tenant)"
            
            # Create private tenant (using service role, bypasses RLS)
            # Note: insert().execute() returns result with .data property
            tenant_result = supabase.table("tenants").insert({
                "name": tenant_name,
                "slug": tenant_slug,
                "domain": None,  # Private tenants never have domains
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
            if not tenant_result.data or len(tenant_result.data) == 0:
                logger.error(f"Failed to create private tenant for user {user_id}")
                return SignUpResponse(
                    success=False,
                    error="Failed to create private tenant"
                )
            
            tenant_id = tenant_result.data[0]["id"]
            logger.info(f"Created private tenant {tenant_id} (name: {tenant_name}, slug: {tenant_slug}) for user {user_id}")
        
        # Step 4: Create or update user profile with tenant_id (using service role, bypasses RLS)
        # Check again if profile exists (might have been created by trigger between Step 1.5 and now)
        existing_profile_check = supabase.table("user_profiles").select("id").eq("id", user_id).limit(1).execute()
        
        if existing_profile_check.data and len(existing_profile_check.data) > 0:
            # Profile exists - update it (don't try to insert)
            logger.info(f"User profile exists for {user_id}, updating with tenant {tenant_id}")
            try:
                update_result = supabase.table("user_profiles").update({
                    "tenant_id": tenant_id,
                    "email": request.email,
                    "full_name": request.full_name,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", user_id).execute()
                
                if not update_result.data:
                    logger.error(f"Failed to update existing user profile for {user_id}")
                    # Clean up tenant if update failed
                    if tenant_id:
                        try:
                            tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                            if tenant_check.data and len(tenant_check.data) > 0:
                                tenant_slug = tenant_check.data[0].get("slug", "")
                                if tenant_slug.endswith("_privateTenant"):
                                    supabase.table("tenants").delete().eq("id", tenant_id).execute()
                                    logger.info(f"Cleaned up orphaned private tenant {tenant_id}")
                        except Exception as cleanup_error:
                            logger.error(f"Error cleaning up tenant: {cleanup_error}")
                    
                    return SignUpResponse(
                        success=False,
                        error="Failed to update user profile"
                    )
                
                logger.info(f"Updated existing user profile for {user_id} with tenant {tenant_id}")
                # Continue to success response below
            except Exception as update_error:
                logger.error(f"Error updating profile: {update_error}")
                # Clean up tenant
                if tenant_id:
                    try:
                        tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                        if tenant_check.data and len(tenant_check.data) > 0:
                            tenant_slug = tenant_check.data[0].get("slug", "")
                            if tenant_slug.endswith("_privateTenant"):
                                supabase.table("tenants").delete().eq("id", tenant_id).execute()
                                logger.info(f"Cleaned up orphaned private tenant {tenant_id}")
                    except Exception as cleanup_error:
                        logger.error(f"Error cleaning up tenant: {cleanup_error}")
                
                return SignUpResponse(
                    success=False,
                    error="Failed to update user profile"
                )
        else:
            # Profile doesn't exist - create it
            try:
                profile_result = supabase.table("user_profiles").insert({
                    "id": user_id,
                    "email": request.email,
                    "full_name": request.full_name,
                    "tenant_id": tenant_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
                
                if not profile_result.data:
                    raise Exception("Profile insert returned no data")
                    
            except PostgrestAPIError as e:
                error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
                error_code = error_dict.get('code', '')
                
                # Handle duplicate key error (user profile already exists - likely from trigger)
                if error_code == '23505':  # Unique violation
                    logger.warning(f"User profile already exists for {user_id} (likely created by trigger), updating instead")
                    
                    # Update existing profile with tenant_id and other info
                    try:
                        update_result = supabase.table("user_profiles").update({
                            "tenant_id": tenant_id,
                            "email": request.email,
                            "full_name": request.full_name,
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", user_id).execute()
                        
                        if not update_result.data:
                            logger.error(f"Failed to update existing user profile for {user_id}")
                            # Clean up tenant if update failed
                            if tenant_id:
                                try:
                                    tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                                    if tenant_check.data and len(tenant_check.data) > 0:
                                        tenant_slug = tenant_check.data[0].get("slug", "")
                                        if tenant_slug.endswith("_privateTenant"):
                                            supabase.table("tenants").delete().eq("id", tenant_id).execute()
                                            logger.info(f"Cleaned up orphaned private tenant {tenant_id}")
                                except Exception as cleanup_error:
                                    logger.error(f"Error cleaning up tenant: {cleanup_error}")
                            
                            return SignUpResponse(
                                success=False,
                                error="Failed to update user profile"
                            )
                        
                        logger.info(f"Updated existing user profile for {user_id} with tenant {tenant_id}")
                        # Continue to success response below
                    except Exception as update_error:
                        logger.error(f"Error updating profile: {update_error}")
                        # Clean up tenant
                        if tenant_id:
                            try:
                                tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                                if tenant_check.data and len(tenant_check.data) > 0:
                                    tenant_slug = tenant_check.data[0].get("slug", "")
                                    if tenant_slug.endswith("_privateTenant"):
                                        supabase.table("tenants").delete().eq("id", tenant_id).execute()
                                        logger.info(f"Cleaned up orphaned private tenant {tenant_id}")
                            except Exception as cleanup_error:
                                logger.error(f"Error cleaning up tenant: {cleanup_error}")
                        
                        return SignUpResponse(
                            success=False,
                            error="Failed to update user profile"
                        )
                else:
                    # Re-raise other database errors
                    raise
        
        logger.info(f"Successfully created user {user_id} with tenant {tenant_id}")
        
        return SignUpResponse(
            success=True,
            user_id=user_id,
            tenant_id=tenant_id
        )
        
    except PostgrestAPIError as e:
        error_dict = e.args[0] if e.args and isinstance(e.args[0], dict) else {}
        error_code = error_dict.get('code', '')
        error_message = error_dict.get('message', str(e))
        
        logger.error(f"Database error in signup: {error_message} (code: {error_code})")
        
        # Clean up tenant if we created one
        if tenant_id and user_id:
            try:
                tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                if tenant_check.data and len(tenant_check.data) > 0:
                    tenant_slug = tenant_check.data[0].get("slug", "")
                    if tenant_slug.endswith("_privateTenant"):
                        supabase.table("tenants").delete().eq("id", tenant_id).execute()
                        logger.info(f"Cleaned up orphaned private tenant {tenant_id} after error")
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up tenant: {cleanup_error}")
        
        return SignUpResponse(
            success=False,
            error=f"Database error: {error_message}"
        )
        
    except Exception as e:
        logger.error(f"Error in signup: {e}", exc_info=True)
        
        # Clean up tenant if we created one
        if tenant_id and user_id:
            try:
                tenant_check = supabase.table("tenants").select("slug").eq("id", tenant_id).execute()
                if tenant_check.data and len(tenant_check.data) > 0:
                    tenant_slug = tenant_check.data[0].get("slug", "")
                    if tenant_slug.endswith("_privateTenant"):
                        supabase.table("tenants").delete().eq("id", tenant_id).execute()
                        logger.info(f"Cleaned up orphaned private tenant {tenant_id} after error")
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up tenant: {cleanup_error}")
        
        return SignUpResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/linkedin/connect", response_model=LinkedInConnectResponse)
async def connect_linkedin(
    request: LinkedInConnectRequest,
    user_info: Dict[str, Any] = Depends(verify_user)
):
    """Initiate LinkedIn OAuth flow"""
    logger.info(f"[LinkedIn Connect] Request received - user_id: {request.user_id}, redirect_uri: {request.redirect_uri}")
    logger.info(f"[LinkedIn Connect] Verified user_info - user_id: {user_info.get('user_id')}, tenant_id: {user_info.get('tenant_id')}")
    
    # Verify user_id matches
    if request.user_id != user_info["user_id"]:
        logger.warning(f"[LinkedIn Connect] User ID mismatch - request: {request.user_id}, verified: {user_info.get('user_id')}")
        raise HTTPException(status_code=403, detail="User ID mismatch")
    
    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        logger.error("[LinkedIn Connect] LinkedIn OAuth credentials not configured")
        raise HTTPException(
            status_code=500,
            detail="LinkedIn OAuth is not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables."
        )
    
    logger.info(f"[LinkedIn Connect] LinkedIn credentials configured - client_id present: {bool(LINKEDIN_CLIENT_ID)}")
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": request.user_id,
        "redirect_uri": request.redirect_uri,
        "created_at": datetime.utcnow()
    }
    logger.info(f"[LinkedIn Connect] Generated OAuth state: {state[:20]}... (stored {len(oauth_states)} states)")
    
    # Build authorization URL
    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": request.redirect_uri,
        "state": state,
        "scope": "openid profile email"  # Request basic profile info
    }
    
    auth_url = f"{LINKEDIN_AUTH_URL}?{urllib.parse.urlencode(params)}"
    logger.info(f"[LinkedIn Connect] Generated auth URL - length: {len(auth_url)}, redirect_uri: {request.redirect_uri}")
    
    return LinkedInConnectResponse(
        auth_url=auth_url,
        state=state
    )

@app.post("/api/linkedin/callback", response_model=LinkedInCallbackResponse)
async def linkedin_callback(
    request: LinkedInCallbackRequest,
    user_info: Dict[str, Any] = Depends(verify_user)
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
    
    user_tenant_id = user_info.get("tenant_id")
    
    # Verify tenant_id matches if provided, otherwise use user's tenant_id
    if request.tenant_id is not None:
        if request.tenant_id != user_tenant_id:
            raise HTTPException(status_code=403, detail="Tenant ID mismatch")
        tenant_id = request.tenant_id
    else:
        # Use user's tenant_id (all users have one now, including private tenants)
        tenant_id = user_tenant_id
    
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID is required")
    
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
        
        # Prepare leads for insertion (all users have tenant_id now)
        leads_to_insert = []
        for profile in profiles:
            leads_to_insert.append({
                "tenant_id": tenant_id,
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
        # Get tenant information (name and admin_notes)
        tenant_result = supabase.table("tenants").select("name, admin_notes").eq("id", request.tenant_id).execute()
        
        tenant_name = None
        admin_notes = None
        if tenant_result.data and len(tenant_result.data) > 0:
            tenant_name = tenant_result.data[0].get("name")
            admin_notes = tenant_result.data[0].get("admin_notes")
        
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
            max_results_per_method=5,  # Generate 5 leads per method
            tenant_name=tenant_name,
            admin_notes=admin_notes
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

@app.post("/api/classify-lead")
async def classify_lead(request: Request):
    """Classify a lead using LLM"""
    try:
        data = await request.json()
        lead_id = data.get("lead_id")
        tenant_id = data.get("tenant_id")
        
        if not lead_id or not tenant_id:
            raise HTTPException(status_code=400, detail="lead_id and tenant_id are required")
        
        # Fetch lead data
        lead_result = supabase.table("leads").select("*").eq("id", lead_id).eq("tenant_id", tenant_id).single().execute()
        
        if not lead_result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead_data = lead_result.data
        
        # Fetch company data
        company_data = None
        if lead_data.get("company_name"):
            company_result = supabase.table("companies").select("*").eq(
                "tenant_id", tenant_id
            ).eq("name", lead_data["company_name"]).limit(1).execute()
            
            if company_result.data and len(company_result.data) > 0:
                company_data = company_result.data[0]
        
        # Classify lead
        classification = llm_service.classify_lead(
            {
                "contact_person": lead_data.get("contact_person", ""),
                "contact_email": lead_data.get("contact_email", ""),
                "role": lead_data.get("role", ""),
                "company_name": lead_data.get("company_name", ""),
            },
            company_data
        )
        
        # Update lead with classification
        update_result = supabase.table("leads").update({
            "tier": classification["tier"],
            "tier_reason": classification["tier_reason"],
            "warm_connections": classification["warm_connections"],
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", lead_id).execute()
        
        return {
            "success": True,
            "classification": classification
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error classifying lead: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error classifying lead: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
