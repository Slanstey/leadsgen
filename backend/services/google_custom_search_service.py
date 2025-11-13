"""
Google Custom Search Service (General Purpose)
Handles general web searches using Google Custom Search API
"""
import os
import requests
from typing import List, Dict, Any, Optional
import logging
import time

logger = logging.getLogger(__name__)


class GoogleCustomSearchService:
    """Service for general web searches using Google Custom Search API"""
    
    def __init__(self, api_key: str, cse_id: str):
        """
        Initialize the Google Custom Search service
        
        Args:
            api_key: Google Custom Search API key
            cse_id: Google Custom Search Engine ID
        """
        self.api_key = api_key
        self.cse_id = cse_id
        self.search_url = "https://www.googleapis.com/customsearch/v1"
    
    def search(
        self,
        query: str,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search the web using Google Custom Search API
        
        Args:
            query: Search query
            max_results: Maximum number of results to return
            
        Returns:
            List of search result dictionaries
        """
        results = []
        processed_urls = set()
        
        try:
            # Google Custom Search API returns max 10 results per request
            num_requests = (max_results + 9) // 10
            
            for i in range(num_requests):
                if len(results) >= max_results:
                    break
                
                start_index = (i * 10) + 1
                
                params = {
                    "key": self.api_key,
                    "cx": self.cse_id,
                    "q": query,
                    "num": min(10, max_results - len(results)),
                    "start": start_index
                }
                
                response = requests.get(self.search_url, params=params, timeout=10)
                
                if response.status_code != 200:
                    logger.error(f"Google Custom Search API error: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                items = data.get("items", [])
                
                for item in items:
                    url = item.get("link", "")
                    if url and url not in processed_urls:
                        processed_urls.add(url)
                        result = self._extract_result(item, query)
                        if result:
                            results.append(result)
                
                # Rate limiting
                if i < num_requests - 1:
                    time.sleep(0.1)
            
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout searching Google Custom Search for: {query}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching Google Custom Search: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Google Custom Search: {e}")
        
        return results[:max_results]
    
    def _extract_result(self, item: Dict[str, Any], query: str) -> Optional[Dict[str, Any]]:
        """Extract information from search result"""
        try:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            url = item.get("link", "")
            
            # Try to extract company/contact info from snippet
            company_name = self._extract_company_name(title, snippet, url)
            contact_info = self._extract_contact_info(snippet)
            
            return {
                "company_name": company_name,
                "contact_person": contact_info.get("name", ""),
                "contact_email": contact_info.get("email", ""),
                "phone": contact_info.get("phone", ""),
                "address": contact_info.get("address", ""),
                "website": url,
                "snippet": snippet,
                "title": title,
                "source": "google_custom_search"
            }
        except Exception as e:
            logger.error(f"Error extracting result: {e}")
            return None
    
    def _extract_company_name(self, title: str, snippet: str, url: str) -> str:
        """Extract company name from search result"""
        # Try title first
        if title:
            # Remove common suffixes
            title_clean = title.split(" - ")[0].split(" | ")[0].strip()
            if len(title_clean) > 3:
                return title_clean
        
        # Try URL domain
        if url:
            try:
                from urllib.parse import urlparse
                domain = urlparse(url).netloc
                domain = domain.replace("www.", "")
                if "." in domain:
                    company = domain.split(".")[0]
                    if len(company) > 2:
                        return company.title()
            except:
                pass
        
        return "Unknown Company"
    
    def _extract_contact_info(self, snippet: str) -> Dict[str, str]:
        """Extract contact information from snippet"""
        import re
        
        contact_info = {
            "name": "",
            "email": "",
            "phone": "",
            "address": ""
        }
        
        # Extract email
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, snippet)
        if emails:
            contact_info["email"] = emails[0]
        
        # Extract phone (basic pattern)
        phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}'
        phones = re.findall(phone_pattern, snippet)
        if phones:
            contact_info["phone"] = phones[0]
        
        # Extract name (simple pattern - first name last name)
        name_pattern = r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b'
        names = re.findall(name_pattern, snippet)
        if names:
            contact_info["name"] = names[0]
        
        return contact_info

