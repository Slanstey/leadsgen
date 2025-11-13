"""
Pure LLM Service
Uses AI/LLM to generate leads based on preferences
"""
import os
import json
import requests
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class LLMService:
    """Service for generating leads using LLM"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        """
        Initialize the LLM service
        
        Args:
            api_key: OpenAI API key (or other LLM provider key)
            model: Model name to use
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.base_url = "https://api.openai.com/v1/chat/completions"
    
    def generate_leads(
        self,
        preferences: Dict[str, Any],
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Generate leads using LLM based on preferences
        
        Args:
            preferences: Tenant preferences dictionary
            max_results: Maximum number of leads to generate
            
        Returns:
            List of lead dictionaries
        """
        if not self.api_key:
            logger.warning("OpenAI API key not configured. Skipping LLM lead generation.")
            return []
        
        try:
            # Build prompt from preferences
            prompt = self._build_prompt(preferences, max_results)
            
            # Call OpenAI API
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a lead generation assistant. Generate realistic business leads based on the provided criteria. Return results as a JSON array."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            }
            
            response = requests.post(
                self.base_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse JSON response
            leads = self._parse_llm_response(content)
            
            return leads[:max_results]
            
        except requests.exceptions.Timeout:
            logger.warning("Timeout calling LLM API")
            return []
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling LLM API: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in LLM service: {e}")
            return []
    
    def _build_prompt(self, preferences: Dict[str, Any], max_results: int) -> str:
        """Build comprehensive prompt for LLM based on all preference fields"""
        # Extract all preference fields
        target_industry = preferences.get("target_industry", "")
        locations = preferences.get("locations", "") or preferences.get("geographic_region", "")
        company_type = preferences.get("company_type", "")
        keywords = preferences.get("keywords", "")
        company_size = preferences.get("company_size", "")
        revenue_range = preferences.get("revenue_range", "")
        technology_stack = preferences.get("technology_stack", "")
        funding_stage = preferences.get("funding_stage", "")
        target_positions = preferences.get("target_positions", "")
        notes = preferences.get("notes", "")
        
        # Build natural language query from all preferences
        query_parts = []
        if company_type:
            query_parts.append(company_type)
        if target_industry:
            query_parts.append(f"in the {target_industry} industry")
        if locations:
            query_parts.append(f"located in {locations}")
        if keywords:
            query_parts.append(f"related to {keywords}")
        
        query = " ".join(query_parts) if query_parts else "businesses"
        
        # Build detailed requirements section
        requirements = []
        if company_size:
            requirements.append(f"- Company size: {company_size}")
        if revenue_range:
            requirements.append(f"- Revenue range: {revenue_range}")
        if technology_stack:
            requirements.append(f"- Technology stack: {technology_stack}")
        if funding_stage:
            requirements.append(f"- Funding stage: {funding_stage}")
        if target_positions:
            requirements.append(f"- Target positions/roles: {target_positions}")
        
        requirements_text = "\n".join(requirements) if requirements else "- Company size: varied"
        
        # Add notes if provided
        notes_section = f"\n\nAdditional context: {notes}" if notes else ""
        
        prompt = f"""Generate {max_results} realistic business leads for: {query}

Requirements:
- Company name (realistic, varied, matching the criteria)
- Contact person name (first and last name)
- Contact email (realistic format, matching company domain)
- Company address (in the specified location: {locations if locations else 'any location'})
- Industry/type matching: {target_industry if target_industry else 'general business'}
{requirements_text}
{notes_section}

Return the results as a JSON array with this exact structure:
[
  {{
    "company_name": "Example Company Name",
    "contact_person": "John Doe",
    "contact_email": "john.doe@example.com",
    "address": "123 Main St, City, Country",
    "industry": "Industry Name",
    "phone": "+1234567890"
  }}
]

Make sure the JSON is valid and properly formatted. Include realistic details that match all the specified criteria."""

        return prompt
    
    def _parse_llm_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse LLM response and extract leads"""
        leads = []
        
        try:
            # Try to extract JSON from response (might be wrapped in markdown)
            content = content.strip()
            
            # Remove markdown code blocks if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # Parse JSON
            parsed = json.loads(content)
            
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        lead = {
                            "company_name": item.get("company_name", "Unknown Company"),
                            "contact_person": item.get("contact_person", "Unknown"),
                            "contact_email": item.get("contact_email", ""),
                            "address": item.get("address", ""),
                            "industry": item.get("industry", "Unknown"),
                            "phone": item.get("phone", ""),
                            "source": "pure_llm"
                        }
                        leads.append(lead)
            elif isinstance(parsed, dict):
                # Single lead
                lead = {
                    "company_name": parsed.get("company_name", "Unknown Company"),
                    "contact_person": parsed.get("contact_person", "Unknown"),
                    "contact_email": parsed.get("contact_email", ""),
                    "address": parsed.get("address", ""),
                    "industry": parsed.get("industry", "Unknown"),
                    "phone": parsed.get("phone", ""),
                    "source": "pure_llm"
                }
                leads.append(lead)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
            logger.debug(f"Response content: {content[:500]}")
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
        
        return leads

