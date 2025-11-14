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
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-5-mini-2025-08-07"):
        """
        Initialize the LLM service
        
        Args:
            api_key: OpenAI API key (or other LLM provider key)
            model: Model name to use
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        # Use responses API instead of completions API
        self.base_url = "https://api.openai.com/v1/responses"
        # Model for system prompt generation (use GPT-4o mini)
        self.system_prompt_model = "gpt-4o-mini"
        # Use completions API for system prompt generation (simpler, no web search needed)
        self.completions_url = "https://api.openai.com/v1/chat/completions"
    
    def generate_leads(
        self,
        preferences: Dict[str, Any],
        max_results: int = 5,
        tenant_name: Optional[str] = None,
        admin_notes: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate leads using LLM based on preferences
        
        Args:
            preferences: Tenant preferences dictionary
            max_results: Maximum number of leads to generate
            tenant_name: Name of the tenant/company generating leads
            admin_notes: Additional notes from admin dashboard
            
        Returns:
            List of lead dictionaries
        """
        if not self.api_key:
            logger.warning("OpenAI API key not configured. Skipping LLM lead generation.")
            return []
        
        try:
            # Step 1: Generate a system prompt using GPT-5 nano
            system_prompt = self._generate_system_prompt(
                preferences=preferences,
                tenant_name=tenant_name,
                admin_notes=admin_notes
            )
            
            if not system_prompt:
                logger.warning("Failed to generate system prompt, using default")
                system_prompt = "You are a lead generation assistant. Generate realistic business leads based on the provided criteria. Return results as a JSON array."
            
            # Step 2: Build prompt from preferences
            prompt = self._build_prompt(preferences, max_results)
            
            logger.info(f"Lead generation - System prompt: {system_prompt}")
            logger.info(f"Lead generation - User prompt: {prompt}")
            
            # Call OpenAI Responses API with the generated system prompt (supports web search)
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Use responses API format for lead generation (supports web search)
            responses_payload = {
                "model": self.model,
                "input": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_output_tokens": 2500,
                "store": False
            }
            
            logger.info(f"Lead generation - Request payload (responses API): {json.dumps(responses_payload, indent=2)}")
            
            response = requests.post(
                self.base_url,
                json=responses_payload,
                headers=headers,
                timeout=180  # Increased timeout for web search
            )
            
            logger.info(f"Lead generation API response status: {response.status_code}")
            logger.info(f"Lead generation API response body: {response.text}")
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            logger.info(f"Lead generation parsed JSON: {json.dumps(data, indent=2)}")
            
            # Check response structure for responses API
            content = None
            if "output" in data:
                # Responses API format - find the message type output
                if isinstance(data["output"], list):
                    for output_item in data["output"]:
                        if output_item.get("type") == "message" and "content" in output_item:
                            # Find the output_text content item
                            content_list = output_item.get("content", [])
                            if isinstance(content_list, list):
                                for content_item in content_list:
                                    if content_item.get("type") == "output_text" and "text" in content_item:
                                        content = content_item["text"]
                                        break
                            if content:
                                break
            elif "choices" in data and len(data["choices"]) > 0:
                # Fallback to completions format
                choice = data["choices"][0]
                if "message" in choice:
                    content = choice["message"].get("content", "")
                elif "content" in choice:
                    content = choice.get("content", "")
            
            if not content:
                logger.error(f"Could not extract content from response. Response structure: {json.dumps(data, indent=2)}")
                return []
            
            logger.info(f"Extracted content (length: {len(content)}): {content[:500]}...")
            
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
    
    def _generate_system_prompt(
        self,
        preferences: Dict[str, Any],
        tenant_name: Optional[str] = None,
        admin_notes: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate a system prompt using GPT-5 nano based on company details and admin notes
        
        Args:
            preferences: Tenant preferences dictionary
            tenant_name: Name of the tenant/company
            admin_notes: Additional notes from admin dashboard
            
        Returns:
            Generated system prompt or None if generation fails
        """
        try:
            # Build user prompt for system prompt generation - only include main company details and admin notes
            user_prompt_parts = []
            
            if tenant_name:
                user_prompt_parts.append(f"Company name: {tenant_name}")
            
            if admin_notes:
                user_prompt_parts.append(f"\nAdditional requirements and context:\n{admin_notes}")
            
            # Add context about what we're creating
            user_prompt_parts.append("\nYou are creating a system prompt for a lead generation AI assistant. This system prompt will be used to guide the assistant in generating business leads.")
            
            user_prompt = "\n".join(user_prompt_parts) if user_prompt_parts else "Create a system prompt for a lead generation AI assistant."
            
            # Hardcoded system prompt for GPT-4o mini
            system_prompt_for_generation = """You are a prompt engineering assistant. Your task is to create a detailed, specific system prompt for a lead generation AI assistant.

Based on the company name and additional requirements provided, create a comprehensive system prompt that will guide the lead generation assistant to find the most relevant and high-quality leads.

The system prompt should:
1. Clearly define the type of leads to generate
2. Include specific criteria and requirements based on the company's needs
3. Emphasize quality and relevance
4. Be specific about what to include and exclude
5. Guide the assistant to generate realistic, useful leads

IMPORTANT: Do not reason internally or explain your thought process. Focus on writing the final text directly. Return the full system prompt text immediately, without any additional reasoning, reflection, or hidden steps. Begin your answer directly with the system prompt content.

Return ONLY the system prompt text, without any additional explanation or formatting."""
            
            logger.info(f"System prompt generation - System prompt: {system_prompt_for_generation}")
            logger.info(f"System prompt generation - User prompt: {user_prompt}")
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.system_prompt_model,
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt_for_generation
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                "max_completion_tokens": 1500
            }
            
            logger.info(f"System prompt generation - Request payload: {json.dumps(payload, indent=2)}")
            
            # Use completions API for system prompt generation (simpler, no web search needed)
            response = requests.post(
                self.completions_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"System prompt generation API response status: {response.status_code}")
            logger.info(f"System prompt generation API response body: {response.text}")
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error generating system prompt: {response.status_code} - {response.text}")
                return None
            
            data = response.json()
            logger.info(f"System prompt generation parsed JSON: {json.dumps(data, indent=2)}")
            
            # Check response structure - GPT-5 models might use different response format
            content = None
            if "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                if "message" in choice:
                    content = choice["message"].get("content", "")
                elif "content" in choice:
                    content = choice.get("content", "")
            
            if not content:
                logger.warning(f"Could not extract content from response. Response structure: {data}")
                return None
            
            generated_prompt = content.strip()
            
            logger.info(f"Generated system prompt (length: {len(generated_prompt)}): {generated_prompt[:200]}...")
            
            if generated_prompt:
                logger.info("Successfully generated system prompt for lead generation")
                return generated_prompt
            else:
                logger.warning("Empty system prompt generated")
                return None
                
        except requests.exceptions.Timeout:
            logger.warning("Timeout calling LLM API for system prompt generation")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling LLM API for system prompt generation: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error generating system prompt: {e}")
            return None
    
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

