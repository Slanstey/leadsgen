"""
Utility functions for extracting city and country from addresses
"""
import re
from typing import Optional


def extract_city_country(address: str) -> str:
    """
    Extract city and country from a full address string.
    
    Handles various address formats:
    - "123 Main St, City, Country"
    - "City, Country"
    - "City, State, Country"
    - "City" or "Country" (if only one provided)
    
    Args:
        address: Full address string
        
    Returns:
        String with format "City, Country" or just "City" or "Country" if only one is available
    """
    if not address or not address.strip():
        return ""
    
    address = address.strip()
    
    # Split by commas
    parts = [part.strip() for part in address.split(",")]
    
    # If we have 2 or fewer parts, return as is (likely already city, country or just city/country)
    if len(parts) <= 2:
        return ", ".join(parts)
    
    # If we have 3+ parts, typically format is: Street, City, State/Province, Country
    # Or: Street, City, Country
    # We want the last two parts (city and country) or last part (country)
    
    # Try to identify country (usually the last part and might be longer, uppercase, or common country names)
    # Common patterns: last part is often country
    if len(parts) >= 2:
        # Take the last two parts (city and country)
        city = parts[-2]
        country = parts[-1]
        
        # If the second-to-last part looks like a state/province (short, uppercase, or common abbreviations)
        # skip it and take the one before that as city
        state_patterns = [
            r'^[A-Z]{2}$',  # Two letter state codes like "CA", "NY"
            r'^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$',
            r'^(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|NT|YT|NU)$',  # Canadian provinces
        ]
        
        is_state = False
        for pattern in state_patterns:
            if re.match(pattern, parts[-2], re.IGNORECASE):
                is_state = True
                break
        
        if is_state and len(parts) >= 3:
            # Skip the state, take city and country
            city = parts[-3]
            country = parts[-1]
        else:
            # Use last two parts
            city = parts[-2]
            country = parts[-1]
        
        return f"{city}, {country}"
    
    # Fallback: return the last part (likely country)
    return parts[-1] if parts else ""

