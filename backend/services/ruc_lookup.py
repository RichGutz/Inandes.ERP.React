import requests
import re
from typing import Optional
from utils.latency import measure_latency

@measure_latency(source="MiniERP", destination="DatosPeru Web", operation_name="Scraping RUC")
def get_company_name_from_web(ruc: str) -> Optional[str]:
    """
    Attempts to fetch the Razón Social (Company Name) for a given RUC
    by scraping public information from datosperu.org.
    
    Args:
        ruc (str): The 11-digit RUC number.
        
    Returns:
        Optional[str]: The company name if found, otherwise None.
    """
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return None

    # URL pattern for datosperu.org (reliable for years)
    # Format: https://www.datosperu.org/empresa-match-[RUC].php
    # They often redirect to the slugified URL, but the search params usually work
    # We will try a direct search query approach if possible, but the pattern "empresa-match-[RUC].php" 
    # is a known entry point that redirects or shows content.
    
    # Actually, a more robust way often used is to search or construct the URL
    url = f"https://www.datosperu.org/empresa-match-{ruc}.php"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            html = response.text
            
            # Pattern matching for title which usually contains "RUC [NUMBER] - [NAME]"
            # <title>RUC 20563361761 ZEN HOLDINGS S.A.C. - Datos Per&uacute;</title>
            title_match = re.search(r'<title>RUC\s+\d+\s+(.*?)\s+-\s+Datos Per', html, re.IGNORECASE)
            
            if title_match:
                name = title_match.group(1).strip()
                # Clean up HTML entities and tags
                name = name.replace("&quot;", '"').replace("&amp;", "&")
                # Remove HTML tags like <br>, <b>, etc.
                name = re.sub(r'<[^>]+>', ' ', name)
                # Remove RUC numbers that might be embedded
                name = re.sub(r'\b\d{11}\b', '', name)
                # Clean up multiple spaces
                name = re.sub(r'\s+', ' ', name).strip()
                return name
                
            # Fallback: Look for h1
            # <h1>ZEN HOLDINGS S.A.C.</h1>
            h1_match = re.search(r'<h1>(.*?)</h1>', html, re.IGNORECASE)
            if h1_match:
                 name = h1_match.group(1).strip()
                 # Apply same cleaning
                 name = re.sub(r'<[^>]+>', ' ', name)
                 name = re.sub(r'\b\d{11}\b', '', name)
                 name = re.sub(r'\s+', ' ', name).strip()
                 return name

    except Exception as e:
        print(f"Error fetching RUC {ruc} from web: {e}")
        return None
        
    return None
