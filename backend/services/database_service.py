"""
Database Service
Handles saving leads and companies to Supabase
"""
from typing import List, Dict, Any, Optional
from supabase import Client
import logging
from datetime import datetime
from utils.location_utils import extract_city_country
from utils.supabase_utils import Tables

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations on leads and companies"""
    
    def __init__(self, supabase_client: Client, llm_service: Optional[Any] = None):
        """
        Initialize the database service
        
        Args:
            supabase_client: Supabase client instance
            llm_service: Optional LLM service instance for lead classification
        """
        self.supabase = supabase_client
        self.llm_service = llm_service
    
    def save_leads_and_companies(
        self,
        leads_data: List[Dict[str, Any]],
        tenant_id: str
    ) -> Dict[str, int]:
        """
        Save leads and companies to database
        
        Args:
            leads_data: List of lead dictionaries
            tenant_id: Tenant ID (all users have a tenant now, including private tenants)
            
        Returns:
            Dictionary with counts of leads_created and companies_created
        """
        leads_created = 0
        companies_created = 0
        
        try:
            # Process each lead
            for lead_data in leads_data:
                try:
                    # Extract company information
                    company_name = lead_data.get("company_name", "").strip()
                    if not company_name or company_name == "Unknown Company":
                        continue
                    
                    # Check if company exists, create if not
                    company_id = self._get_or_create_company(
                        company_name=company_name,
                        tenant_id=tenant_id,
                        company_data=lead_data
                    )
                    
                    if company_id:
                        companies_created += 1
                    
                    # Create lead
                    lead_id = self._create_lead(
                        tenant_id=tenant_id,
                        company_name=company_name,
                        lead_data=lead_data
                    )
                    
                    if lead_id:
                        leads_created += 1
                        
                except Exception as e:
                    logger.error(f"Error processing lead: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Error saving leads and companies: {e}")
        
        return {
            "leads_created": leads_created,
            "companies_created": companies_created
        }
    
    def _get_or_create_company(
        self,
        company_name: str,
        tenant_id: str,
        company_data: Dict[str, Any]
    ) -> Optional[str]:
        """Get existing company or create new one"""
        try:
            # Check if company exists
            existing = self.supabase.table(Tables.COMPANIES).select("id").eq(
                "tenant_id", tenant_id
            ).eq("name", company_name).limit(1).execute()
            
            if existing.data and len(existing.data) > 0:
                return existing.data[0]["id"]
            
            # Create new company
            # Extract city and country from address
            address = company_data.get("address", "")
            location = extract_city_country(address) if address else ""
            
            company_insert = {
                "tenant_id": tenant_id,
                "name": company_name,
                "location": location,
                "industry": company_data.get("industry", "Unknown"),
                "sub_industry": company_data.get("sub_industry", ""),
                "annual_revenue": company_data.get("annual_revenue", ""),
                "description": company_data.get("description", ""),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table(Tables.COMPANIES).insert(company_insert).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
            
        except Exception as e:
            logger.error(f"Error getting/creating company: {e}")
        
        return None
    
    def _create_lead(
        self,
        tenant_id: str,
        company_name: str,
        lead_data: Dict[str, Any]
    ) -> Optional[str]:
        """Create a lead"""
        try:
            # Check if lead already exists (by company name and contact person)
            contact_person = lead_data.get("contact_person", "").strip()
            
            if contact_person:
                existing = self.supabase.table(Tables.LEADS).select("id").eq(
                    "tenant_id", tenant_id
                ).eq("company_name", company_name).eq(
                    "contact_person", contact_person
                ).limit(1).execute()
                
                if existing.data and len(existing.data) > 0:
                    # Lead already exists, skip
                    return None
            
            # Get company data for classification
            company_data = None
            if company_name:
                company_result = self.supabase.table(Tables.COMPANIES).select("*").eq(
                    "tenant_id", tenant_id
                ).eq("name", company_name).limit(1).execute()
                
                if company_result.data and len(company_result.data) > 0:
                    company_data = company_result.data[0]
            
            # Use tier/tier_reason/warm_connections from lead_data if provided, otherwise classify
            tier = lead_data.get("tier", "medium")
            tier_reason = lead_data.get("tier_reason", "")
            warm_connections = lead_data.get("warm_connections", "")
            
            # Only classify if tier/tier_reason are not already set
            if not tier or tier == "medium" and not tier_reason and self.llm_service:
                try:
                    classification = self.llm_service.classify_lead(lead_data, company_data)
                    tier = classification.get("tier", tier or "medium")
                    tier_reason = classification.get("tier_reason", tier_reason)
                    warm_connections = classification.get("warm_connections", warm_connections)
                except Exception as e:
                    logger.error(f"Error classifying lead: {e}")
                    # Continue with existing or default values
            
            # Use status from lead_data if provided, otherwise default to "not_contacted"
            status = lead_data.get("status", "not_contacted")
            
            # Create new lead (all users have tenant_id now)
            # Handle is_connected_to_tenant - convert string to boolean if needed
            is_connected_to_tenant = lead_data.get("is_connected_to_tenant", False)
            if isinstance(is_connected_to_tenant, str):
                is_connected_to_tenant = is_connected_to_tenant.lower() in ("true", "1", "yes", "y")
            elif not isinstance(is_connected_to_tenant, bool):
                is_connected_to_tenant = False
            
            lead_insert = {
                "tenant_id": tenant_id,
                "company_name": company_name,
                "contact_person": contact_person or "Unknown",
                "contact_email": lead_data.get("contact_email", ""),
                "role": lead_data.get("role", ""),
                "status": status,
                "tier": tier,
                "tier_reason": tier_reason,
                "warm_connections": warm_connections,
                "is_connected_to_tenant": is_connected_to_tenant,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table(Tables.LEADS).insert(lead_insert).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
            
        except Exception as e:
            logger.error(f"Error creating lead: {e}")
        
        return None

