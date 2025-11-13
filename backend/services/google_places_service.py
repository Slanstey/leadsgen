"""
Google Places API Service
Handles searching for businesses using Google Places API
"""
import os
import requests
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class GooglePlacesService:
    """Service for searching businesses using Google Places API"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Google Places service
        
        Args:
            api_key: Google Places API key (optional)
        """
        self.api_key = api_key
        self.base_url = "https://places.googleapis.com/v1/places:searchText"
    
    def search_businesses(
        self,
        query: str,
        location: Optional[str] = None,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for businesses using Google Places API
        
        Args:
            query: Search query (e.g., "private pharmacies in South Africa")
            location: Optional location filter (e.g., "South Africa")
            max_results: Maximum number of results to return
            
        Returns:
            List of business dictionaries with name, address, phone, website, etc.
        """
        if not self.api_key:
            logger.warning("Google Places API key not configured. Skipping search.")
            return []
        
        businesses = []
        
        try:
            # Build request payload
            payload = {
                "textQuery": query,
                "maxResultCount": min(max_results, 20),  # API limit is 20 per request
                "languageCode": "en"
            }
            
            # Add includedType if we can detect it from query
            if "pharmacy" in query.lower():
                payload["includedType"] = "pharmacy"
            
            # Add location bias if provided
            if location:
                # For now, we'll use text query with location in it
                # In production, you might want to use locationRestriction with bounds
                pass
            
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.location,places.businessStatus"
            }
            
            response = requests.post(
                self.base_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                logger.error(f"Google Places API error: {response.status_code} - {response.text}")
                return businesses
            
            data = response.json()
            places = data.get("places", [])
            
            for place in places:
                business = self._extract_business_info(place)
                if business:
                    businesses.append(business)
            
            # Handle pagination if needed
            next_page_token = data.get("nextPageToken")
            if next_page_token and len(businesses) < max_results:
                # Note: In production, implement pagination properly
                logger.info(f"More results available (pagination not fully implemented)")
            
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout searching Google Places for: {query}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching Google Places: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Google Places search: {e}")
        
        return businesses[:max_results]
    
    def _extract_business_info(self, place: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract business information from Google Places API response"""
        try:
            display_name = place.get("displayName", {}).get("text", "Unknown Business")
            address = place.get("formattedAddress", "")
            phone = place.get("nationalPhoneNumber", "")
            website = place.get("websiteUri", "")
            location = place.get("location", {})
            business_status = place.get("businessStatus", "OPERATIONAL")
            
            # Extract company name
            company_name = display_name
            
            # Extract location coordinates
            lat = location.get("latitude") if location else None
            lng = location.get("longitude") if location else None
            
            # Extract types/categories
            types = place.get("types", [])
            industry = types[0] if types else "Unknown"
            
            return {
                "company_name": company_name,
                "address": address,
                "phone": phone,
                "website": website,
                "latitude": lat,
                "longitude": lng,
                "industry": industry,
                "status": business_status,
                "source": "google_places_api"
            }
        except Exception as e:
            logger.error(f"Error extracting business info: {e}")
            return None

