"""
Agentic Workflow Orchestrator
Coordinates multiple lead generation services based on methods and preferences
"""
from typing import List, Dict, Any, Optional
import logging

from .google_places_service import GooglePlacesService
from .llm_service import LLMService
from .google_custom_search_service import GoogleCustomSearchService
from .linkedin_search import LinkedInSearchService
from .database_service import DatabaseService

logger = logging.getLogger(__name__)


class WorkflowOrchestrator:
    """Orchestrates lead generation across multiple services"""
    
    def __init__(
        self,
        google_places_service: Optional[GooglePlacesService] = None,
        llm_service: Optional[LLMService] = None,
        google_custom_search_service: Optional[GoogleCustomSearchService] = None,
        linkedin_search_service: Optional[LinkedInSearchService] = None,
        database_service: Optional[DatabaseService] = None
    ):
        """
        Initialize the workflow orchestrator
        
        Args:
            google_places_service: Google Places API service instance
            llm_service: LLM service instance
            google_custom_search_service: Google Custom Search service instance
            linkedin_search_service: LinkedIn search service instance
            database_service: Database service instance
        """
        self.google_places_service = google_places_service
        self.llm_service = llm_service
        self.google_custom_search_service = google_custom_search_service
        self.linkedin_search_service = linkedin_search_service
        self.database_service = database_service
    
    def generate_leads(
        self,
        methods: List[str],
        preferences: Dict[str, Any],
        tenant_id: str,
        max_results_per_method: int = 20,
        tenant_name: Optional[str] = None,
        admin_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate leads using specified methods and preferences
        
        Args:
            methods: List of lead generation methods to use
            preferences: Tenant preferences dictionary
            tenant_id: Tenant ID
            max_results_per_method: Maximum results per method
            tenant_name: Name of the tenant/company
            admin_notes: Additional notes from admin dashboard
            
        Returns:
            Dictionary with results summary
        """
        all_leads = []
        method_results = {}
        errors = []
        
        # Build search query from preferences
        search_query = self._build_search_query(preferences)
        
        logger.info(f"Starting lead generation for tenant {tenant_id} with methods: {methods}")
        logger.info(f"Search query: {search_query}")
        logger.info(f"Preferences keys: {list(preferences.keys())}")
        logger.debug(f"Full preferences: {preferences}")
        
        # Process each method
        for method in methods:
            try:
                logger.info(f"Processing method: {method}")
                leads = self._process_method(
                    method, 
                    preferences, 
                    search_query, 
                    max_results_per_method,
                    tenant_name=tenant_name,
                    admin_notes=admin_notes
                )
                
                if leads:
                    all_leads.extend(leads)
                    method_results[method] = len(leads)
                    logger.info(f"Method {method} generated {len(leads)} leads")
                else:
                    method_results[method] = 0
                    logger.warning(f"Method {method} generated no leads")
                    
            except Exception as e:
                error_msg = f"Error in method {method}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
                method_results[method] = 0
        
        # Deduplicate leads
        deduplicated_leads = self._deduplicate_leads(all_leads)
        logger.info(f"Total leads before deduplication: {len(all_leads)}, after: {len(deduplicated_leads)}")
        
        # Save to database
        save_results = {"leads_created": 0, "companies_created": 0}
        if self.database_service and deduplicated_leads:
            try:
                save_results = self.database_service.save_leads_and_companies(
                    deduplicated_leads,
                    tenant_id
                )
                logger.info(f"Saved {save_results['leads_created']} leads and {save_results['companies_created']} companies")
            except Exception as e:
                error_msg = f"Error saving to database: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
        
        return {
            "success": save_results["leads_created"] > 0,
            "leads_created": save_results["leads_created"],
            "companies_created": save_results["companies_created"],
            "method_results": method_results,
            "total_leads_found": len(deduplicated_leads),
            "errors": errors if errors else None
        }
    
    def _process_method(
        self,
        method: str,
        preferences: Dict[str, Any],
        search_query: str,
        max_results: int,
        tenant_name: Optional[str] = None,
        admin_notes: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Process a single lead generation method"""
        leads = []
        
        if method == "google_places_api":
            if not self.google_places_service:
                raise ValueError("Google Places service not initialized")
            
            # Build comprehensive query from all preferences
            location = preferences.get("locations", "") or preferences.get("geographic_region", "")
            
            # Build query using all relevant preference fields
            query_parts = []
            if preferences.get("company_type"):
                query_parts.append(preferences.get("company_type"))
            if preferences.get("target_industry"):
                query_parts.append(preferences.get("target_industry"))
            if preferences.get("keywords"):
                query_parts.append(preferences.get("keywords"))
            if location:
                query_parts.append(location)
            
            query = " ".join(query_parts) if query_parts else search_query or "businesses"
            
            logger.info(f"Google Places API query: {query} (location: {location})")
            
            businesses = self.google_places_service.search_businesses(
                query=query,
                location=location,
                max_results=max_results
            )
            
            # Convert businesses to leads format
            for business in businesses:
                leads.append({
                    "company_name": business.get("company_name", ""),
                    "contact_person": "Contact",  # Google Places doesn't provide contact person
                    "contact_email": "",
                    "role": "",
                    "address": business.get("address", ""),
                    "phone": business.get("phone", ""),
                    "website": business.get("website", ""),
                    "industry": business.get("industry", ""),
                    "source": "google_places_api"
                })
        
        elif method == "pure_llm":
            if not self.llm_service:
                raise ValueError("LLM service not initialized")
            
            llm_leads = self.llm_service.generate_leads(
                preferences=preferences,
                max_results=max_results,
                tenant_name=tenant_name,
                admin_notes=admin_notes
            )
            leads.extend(llm_leads)
        
        elif method == "google_custom_search":
            if not self.google_custom_search_service:
                raise ValueError("Google Custom Search service not initialized")
            
            # Build comprehensive search query from all preferences
            query = search_query or self._build_search_query(preferences)
            
            logger.info(f"Google Custom Search query: {query}")
            
            search_results = self.google_custom_search_service.search(
                query=query,
                max_results=max_results
            )
            
            # Convert search results to leads format
            for result in search_results:
                leads.append({
                    "company_name": result.get("company_name", ""),
                    "contact_person": result.get("contact_person", ""),
                    "contact_email": result.get("contact_email", ""),
                    "role": "",
                    "address": result.get("address", ""),
                    "phone": result.get("phone", ""),
                    "website": result.get("website", ""),
                    "industry": preferences.get("target_industry", ""),
                    "source": "google_custom_search"
                })
        
        elif method == "linkedin_search":
            if not self.linkedin_search_service:
                raise ValueError("LinkedIn search service not initialized")
            
            # Extract LinkedIn-specific preferences with fallbacks
            locations_str = (
                preferences.get("locations") or 
                preferences.get("linkedin_locations") or 
                preferences.get("geographic_region") or 
                ""
            )
            positions_str = (
                preferences.get("target_positions") or 
                preferences.get("linkedin_positions") or 
                preferences.get("target_roles") or 
                ""
            )
            
            if not locations_str or not positions_str:
                logger.warning("LinkedIn search requires locations and target_positions")
                logger.debug(f"Available preference keys: {list(preferences.keys())}")
                return leads
            
            locations = [loc.strip() for loc in locations_str.split(",") if loc.strip()]
            positions = [pos.strip() for pos in positions_str.split(",") if pos.strip()]
            
            experience_operator = (
                preferences.get("experience_operator") or 
                preferences.get("linkedin_experience_operator", "=")
            )
            experience_years = (
                preferences.get("experience_years") or 
                preferences.get("linkedin_experience_years", 0)
            )
            
            logger.info(f"LinkedIn search - locations: {locations}, positions: {positions}, experience: {experience_operator} {experience_years}")
            
            profiles = self.linkedin_search_service.search_profiles(
                locations=locations,
                positions=positions,
                experience_operator=experience_operator,
                experience_years=experience_years,
                limit=max_results
            )
            
            # Convert profiles to leads format
            for profile in profiles:
                leads.append({
                    "company_name": profile.get("company", ""),
                    "contact_person": profile.get("name", ""),
                    "contact_email": "",
                    "role": profile.get("role", ""),
                    "address": "",
                    "phone": "",
                    "website": profile.get("url", ""),
                    "industry": preferences.get("target_industry", ""),
                    "source": "linkedin_search"
                })
        
        else:
            raise ValueError(f"Unknown method: {method}")
        
        return leads
    
    def _build_search_query(self, preferences: Dict[str, Any]) -> str:
        """Build a comprehensive search query from all preference fields"""
        query_parts = []
        
        # Add company type (e.g., "private", "public", "pharmacy")
        company_type = preferences.get("company_type", "")
        if company_type:
            query_parts.append(company_type)
        
        # Add target industry
        target_industry = preferences.get("target_industry", "")
        if target_industry:
            query_parts.append(target_industry)
        
        # Add locations/geographic region
        locations = preferences.get("locations", "") or preferences.get("geographic_region", "")
        if locations:
            query_parts.append(locations)
        
        # Add keywords
        keywords = preferences.get("keywords", "")
        if keywords:
            query_parts.append(keywords)
        
        # Add company size if relevant
        company_size = preferences.get("company_size", "")
        if company_size:
            query_parts.append(company_size)
        
        # Add technology stack if relevant
        technology_stack = preferences.get("technology_stack", "")
        if technology_stack:
            query_parts.append(technology_stack)
        
        # Add funding stage if relevant
        funding_stage = preferences.get("funding_stage", "")
        if funding_stage:
            query_parts.append(funding_stage)
        
        # If no specific parts, use a generic query
        if not query_parts:
            query_parts.append("businesses")
        
        return " ".join(query_parts)
    
    def _deduplicate_leads(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate leads based on company name and contact person"""
        seen = set()
        deduplicated = []
        
        for lead in leads:
            company_name = lead.get("company_name", "").strip().lower()
            contact_person = lead.get("contact_person", "").strip().lower()
            
            # Create a unique key
            key = f"{company_name}|{contact_person}"
            
            if key not in seen and company_name:
                seen.add(key)
                deduplicated.append(lead)
        
        return deduplicated

