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
                    logger.info(f"Searching for {position} in {location} (experience: {experience_operator} {experience_years})")
                    results = self._execute_search(query)
                    
                    if not results:
                        logger.warning(f"No results found for {position} in {location}")
                        continue
                    
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
                            logger.debug(f"Extracted profile: {profile['name']} - {profile['company']} - {profile['role']}")
                        else:
                            logger.debug(f"Failed to extract profile from: {url}")
                    
                    time.sleep(0.2)  # Rate limiting (slightly increased)
                    
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
        
        logger.debug(f"Executing search query: {query}")
        
        try:
            response = requests.get(self.search_url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for API errors
            if "error" in data:
                error_info = data.get("error", {})
                error_message = error_info.get("message", "Unknown API error")
                logger.error(f"Google Custom Search API error: {error_message}")
                return []
            
            items = data.get("items", [])
            logger.info(f"Found {len(items)} results for query: {query}")
            
            # Filter to only LinkedIn URLs
            linkedin_items = []
            for item in items:
                url = item.get("link", "")
                if url and "linkedin.com/in/" in url:
                    linkedin_items.append(item)
                else:
                    logger.debug(f"Skipping non-LinkedIn URL: {url}")
            
            return linkedin_items
            
        except requests.exceptions.Timeout:
            logger.error(f"Timeout executing search query: {query}")
            raise
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error executing search query: {query}, status: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error executing search query: {query}, error: {e}")
            raise
    
    def _extract_profile(self, item: Dict[str, Any], position: str) -> Dict[str, Any]:
        """Extract profile information from search result"""
        url = item.get("link", "")
        snippet = item.get("snippet", "")
        title = item.get("title", "")
        
        # Validate URL is a LinkedIn profile URL
        if not url or "linkedin.com/in/" not in url:
            logger.warning(f"Invalid LinkedIn URL: {url}")
            return None
        
        name = self._extract_name(title, snippet, url)
        company = self._extract_company(snippet, title)
        role = self._extract_role(snippet, title, position)
        
        # Validate we got meaningful data
        if name == "Unknown" and company == "Unknown Company":
            logger.debug(f"Skipping profile with insufficient data: {url}")
            return None
        
        return {
            "name": name,
            "company": company,
            "role": role,
            "url": url,
            "snippet": snippet
        }
    
    def _extract_name(self, title: str, snippet: str, url: str) -> str:
        """Extract name from LinkedIn profile data"""
        # Try title first (usually more reliable)
        name_patterns = [
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-|]",  # "John Doe -" or "John Doe |"
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+at\s+",  # "John Doe at Company"
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*:",  # "John Doe:"
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*$",  # "John Doe" at start
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-|]",  # "John Doe -" anywhere
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, title)
            if match:
                name = match.group(1).strip()
                # Validate it looks like a name (2-3 words, each capitalized)
                words = name.split()
                if 2 <= len(words) <= 3 and all(word[0].isupper() for word in words if word):
                    return name
        
        # Try snippet
        for pattern in name_patterns:
            match = re.search(pattern, snippet)
            if match:
                name = match.group(1).strip()
                words = name.split()
                if 2 <= len(words) <= 3 and all(word[0].isupper() for word in words if word):
                    return name
        
        # Fallback to URL (most reliable)
        url_match = re.search(r"linkedin\.com/in/([^/?]+)", url)
        if url_match:
            url_name = url_match.group(1).replace("-", " ")
            # Clean up common URL patterns
            url_name = re.sub(r'\d+', '', url_name)  # Remove numbers
            words = [word.capitalize() for word in url_name.split() if word and word.isalpha()]
            if len(words) >= 2:
                return " ".join(words[:3])  # Max 3 words
        
        return "Unknown"
    
    def _extract_company(self, snippet: str, title: str) -> str:
        """Extract company name from LinkedIn profile data"""
        # Common patterns for company extraction
        company_patterns = [
            r"at\s+([A-Z][A-Za-z0-9\s&'\-\.]+?)(?:\s*[-|,\.]|\s+at\s+|\s*$|\s*·)",  # "at Company Name"
            r"[-|]\s*([A-Z][A-Za-z0-9\s&'\-\.]+?)\s*[-|]",  # "- Company Name -"
            r"(?:works? at|current|previous|employed at)[:\s]+([A-Z][A-Za-z0-9\s&'\-\.]+)",  # "works at Company"
            r"([A-Z][A-Za-z0-9\s&'\-\.]{2,50})\s*[-|]\s*(?:CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Lead|Senior|Junior)",  # "Company - Title"
            r"([A-Z][A-Za-z0-9\s&'\-\.]+)\s*·\s*",  # "Company ·"
            r"(?:CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Lead|Senior|Junior|President|Chief)\s+(?:of|at)\s+([A-Z][A-Za-z0-9\s&'\-\.]+)",  # "CEO of Company"
        ]
        
        # Words that should not be extracted as company names
        invalid_companies = [
            "linkedin", "profile", "view", "the", "a", "an", "have", "has", "had",
            "chief", "executive", "officer", "president", "director", "manager",
            "engineer", "developer", "designer", "analyst", "lead", "senior", "junior",
            "vice", "vp", "ceo", "cto", "cfo", "coo", "experience", "education",
            "location", "greater", "united", "states", "inc", "llc", "ltd"
        ]
        
        # Try snippet first (usually has more detail)
        for pattern in company_patterns:
            match = re.search(pattern, snippet, re.IGNORECASE)
            if match and match.group(1):
                company = match.group(1).strip()
                company = re.sub(r"^\s*at\s+", "", company, flags=re.IGNORECASE)
                company = re.sub(r"^\s*(?:of|at)\s+", "", company, flags=re.IGNORECASE)
                company = re.sub(r"\s+", " ", company)  # Normalize whitespace
                # Filter out common false positives
                company_lower = company.lower()
                if (company_lower not in invalid_companies and 
                    not any(word in company_lower for word in invalid_companies if len(word) > 3) and
                    2 < len(company) < 100):
                    return company
        
        # Try title
        for pattern in company_patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match and match.group(1):
                company = match.group(1).strip()
                company = re.sub(r"^\s*at\s+", "", company, flags=re.IGNORECASE)
                company = re.sub(r"^\s*(?:of|at)\s+", "", company, flags=re.IGNORECASE)
                company = re.sub(r"\s+", " ", company)
                company_lower = company.lower()
                if (company_lower not in invalid_companies and 
                    not any(word in company_lower for word in invalid_companies if len(word) > 3) and
                    2 < len(company) < 100):
                    return company
        
        return "Unknown Company"
    
    def _extract_role(self, snippet: str, title: str, position: str) -> str:
        """Extract role from LinkedIn profile data"""
        # Common role patterns - try full titles first
        role_patterns = [
            r"([A-Z][A-Za-z\s]+?)\s+at\s+[A-Z]",  # "Role at Company"
            r"(Chief\s+Executive\s+Officer|Chief\s+Technology\s+Officer|Chief\s+Financial\s+Officer|Chief\s+Operating\s+Officer|Vice\s+President|Head\s+of)",  # Full titles
            r"[-|]\s*([A-Z][A-Za-z\s]+?)\s*[-|]",  # "- Role -"
            r"(CEO|CTO|CFO|COO|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Lead|Senior|Junior|Principal|Chief)",  # Common titles/abbreviations
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-|]\s*[A-Z]",  # "Role Title - Company"
            r"(President|CEO|CTO|CFO|COO|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Lead|Senior|Junior|Principal|Head of|Chief)\s+(?:of|at)",  # "Title of/at"
        ]
        
        invalid_roles = ["linkedin", "profile", "view", "experience", "education", "location"]
        
        # Try snippet first
        for pattern in role_patterns:
            match = re.search(pattern, snippet, re.IGNORECASE)
            if match:
                role = match.group(1).strip() if match.lastindex else match.group(0).strip()
                # Clean up common prefixes
                role = re.sub(r"^(?:of|at)\s+", "", role, flags=re.IGNORECASE)
                # Validate it's not a name or company
                if (len(role.split()) <= 5 and 
                    role.lower() not in invalid_roles and
                    len(role) > 2):
                    return role
        
        # Try title
        for pattern in role_patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                role = match.group(1).strip() if match.lastindex else match.group(0).strip()
                role = re.sub(r"^(?:of|at)\s+", "", role, flags=re.IGNORECASE)
                if (len(role.split()) <= 5 and 
                    role.lower() not in invalid_roles and
                    len(role) > 2):
                    return role
        
        # Fallback to search position if it's meaningful
        if position and position.lower() not in ["unknown", "unknown role", ""]:
            return position
        
        return "Unknown Role"

