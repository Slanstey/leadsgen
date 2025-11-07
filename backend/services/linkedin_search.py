"""
LinkedIn Search Service
Handles searching for LinkedIn profiles using Google Custom Search API
Based on ConneXion for LinkedIn approach: https://github.com/ethbak/connexion-for-linkedin
"""
import os
import re
import time
import requests
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class LinkedInSearchService:
    """Service for searching LinkedIn profiles using Google Custom Search API"""
    
    def __init__(self, api_key: str, cse_id: str):
        """
        Initialize the LinkedIn search service
        
        Args:
            api_key: Google Custom Search API key
            cse_id: Google Custom Search Engine ID
        """
        self.api_key = api_key
        self.cse_id = cse_id
        self.search_url = "https://www.googleapis.com/customsearch/v1"
        
        if self.cse_id == self.api_key:
            raise ValueError("CSE ID cannot be the same as API key")
    
    def search_profiles(
        self,
        locations: List[str],
        positions: List[str],
        experience_operator: str = "=",
        experience_years: int = 0,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for LinkedIn profiles based on criteria
        
        Args:
            locations: List of locations to search
            positions: List of positions/titles to search
            experience_operator: Experience operator (">", "<", or "=")
            experience_years: Years of experience
            limit: Maximum number of profiles to return
            
        Returns:
            List of profile dictionaries with name, company, role, url, snippet
        """
        profiles = []
        processed_urls = set()
        
        for location in locations:
            location = location.strip()
            if len(profiles) >= limit:
                break
                
            for position in positions:
                if len(profiles) >= limit:
                    break
                    
                position = position.strip()
                query = self._build_search_query(position, location, experience_operator, experience_years)
                
                try:
                    results = self._execute_search(query)
                    for item in results:
                        if len(profiles) >= limit:
                            break
                            
                        url = item.get("link", "")
                        if not url or url in processed_urls:
                            continue
                            
                        processed_urls.add(url)
                        profile = self._extract_profile(item, position)
                        if profile:
                            profiles.append(profile)
                    
                    time.sleep(0.1)  # Rate limiting
                    
                except requests.exceptions.Timeout:
                    logger.warning(f"Timeout searching for {position} in {location}")
                    continue
                except requests.exceptions.HTTPError as e:
                    logger.error(f"HTTP error searching for {position} in {location}: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Error searching for {position} in {location}: {e}")
                    continue
        
        return profiles[:limit]
    
    def _build_search_query(
        self,
        position: str,
        location: str,
        experience_operator: str,
        experience_years: int
    ) -> str:
        """Build Google search query"""
        query = f"site:linkedin.com/in {position} {location}"
        
        if experience_years > 0:
            years_text = f"{experience_years} years"
            if experience_operator == ">":
                query += f' "{years_text}" OR "{experience_years}+ years"'
            elif experience_operator == "<":
                query += f' "less than {years_text}" OR "junior" OR "entry level"'
            else:
                query += f' "{years_text}"'
        
        return query
    
    def _execute_search(self, query: str) -> List[Dict[str, Any]]:
        """Execute Google Custom Search API request"""
        params = {
            "key": self.api_key,
            "cx": self.cse_id,
            "q": query,
            "num": 10
        }
        
        response = requests.get(self.search_url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        return data.get("items", [])
    
    def _extract_profile(self, item: Dict[str, Any], position: str) -> Dict[str, Any]:
        """Extract profile information from search result"""
        url = item.get("link", "")
        snippet = item.get("snippet", "")
        title = item.get("title", "")
        
        return {
            "name": self._extract_name(title, snippet, url),
            "company": self._extract_company(snippet, title),
            "role": self._extract_role(snippet, title, position),
            "url": url,
            "snippet": snippet
        }
    
    def _extract_name(self, title: str, snippet: str, url: str) -> str:
        """Extract name from LinkedIn profile data"""
        name_patterns = [
            r"^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            r"([A-Z][a-z]+ [A-Z][a-z]+)\s*[-|]",
            r"([A-Z][a-z]+ [A-Z][a-z]+)\s+at",
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, title) or re.search(pattern, snippet)
            if match:
                return match.group(1).strip()
        
        # Fallback to URL
        url_match = re.search(r"linkedin\.com/in/([^/?]+)", url)
        if url_match:
            url_name = url_match.group(1).replace("-", " ")
            return " ".join(word.capitalize() for word in url_name.split())
        
        return "Unknown"
    
    def _extract_company(self, snippet: str, title: str) -> str:
        """Extract company name from LinkedIn profile data"""
        company_patterns = [
            r"at\s+([A-Z][^,\.\n]+?)(?:\s*[-|,\.]|\s+at|\s*$)",
            r"([A-Z][a-zA-Z\s&]+)\s*[-|]\s*(?:CEO|CTO|VP|Director|Manager|Engineer)",
            r"(?:works? at|current|previous)[:\s]+([A-Z][^,\.\n]+)",
        ]
        
        for pattern in company_patterns:
            match = re.search(pattern, snippet, re.IGNORECASE) or re.search(pattern, title, re.IGNORECASE)
            if match and match.group(1):
                company = match.group(1).strip()
                company = re.sub(r"^\s*at\s+", "", company, flags=re.IGNORECASE)
                if 2 < len(company) < 100:
                    return company
        
        return "Unknown Company"
    
    def _extract_role(self, snippet: str, title: str, position: str) -> str:
        """Extract role from LinkedIn profile data"""
        role_patterns = [
            r"([A-Z][^,\.]+?)\s+at\s+[A-Z]",
            r"(CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Analyst)",
        ]
        
        for pattern in role_patterns:
            match = re.search(pattern, snippet, re.IGNORECASE) or re.search(pattern, title, re.IGNORECASE)
            if match:
                if match.lastindex and match.group(1):
                    return match.group(1).strip()
                else:
                    return match.group(0).strip()
        
        return position if position else "Unknown Role"

