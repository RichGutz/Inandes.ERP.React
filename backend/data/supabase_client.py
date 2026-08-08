# src/data/supabase_client.py

import os
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv

# --- Singleton instance ---
_supabase_client_instance: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Initializes and returns a singleton Supabase client instance.
    """
    global _supabase_client_instance
    if _supabase_client_instance is None:
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("APP_SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("APP_SUPABASE_KEY")

        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "Supabase credentials not found. Set SUPABASE_URL and SUPABASE_KEY in .env."
            )

        _supabase_client_instance = create_client(SUPABASE_URL, SUPABASE_KEY)

    return _supabase_client_instance

