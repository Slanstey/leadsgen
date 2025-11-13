"""
Database Service
Handles saving leads and companies to Supabase
"""
from typing import List, Dict, Any, Optional
from supabase import Client
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations on leads and companies"""
    
    def __init__(self, supabase_client: Client):
        """
        Initialize the database service
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client
    
    def save_leads_and_companies(
        self,
        leads_data: List[Dict[str, Any]],
        tenant_id: str
    ) -> Dict[str, int]:
        """
        Save leads and companies to database
        
        Args:
            leads_data: List of lead dictionaries
            tenant_id: Tenant ID
            
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
            existing = self.supabase.table("companies").select("id").eq(
                "tenant_id", tenant_id
            ).eq("name", company_name).limit(1).execute()
            
            if existing.data and len(existing.data) > 0:
                return existing.data[0]["id"]
            
            # Create new company
            company_insert = {
                "tenant_id": tenant_id,
                "name": company_name,
                "location": company_data.get("address", ""),
                "industry": company_data.get("industry", "Unknown"),
                "sub_industry": company_data.get("sub_industry", ""),
                "annual_revenue": company_data.get("annual_revenue", ""),
                "description": company_data.get("description", ""),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("companies").insert(company_insert).execute()
            
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
                existing = self.supabase.table("leads").select("id").eq(
                    "tenant_id", tenant_id
                ).eq("company_name", company_name).eq(
                    "contact_person", contact_person
                ).limit(1).execute()
                
                if existing.data and len(existing.data) > 0:
                    # Lead already exists, skip
                    return None
            
            # Create new lead
            lead_insert = {
                "tenant_id": tenant_id,
                "company_name": company_name,
                "contact_person": contact_person or "Unknown",
                "contact_email": lead_data.get("contact_email", ""),
                "role": lead_data.get("role", ""),
                "status": "not_contacted",
                "tier": 1,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("leads").insert(lead_insert).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
            
        except Exception as e:
            logger.error(f"Error creating lead: {e}")
        
        return None

