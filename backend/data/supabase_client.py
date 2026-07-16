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
    Priority: Streamlit secrets > environment variables > .env file
    """
    global _supabase_client_instance
    if _supabase_client_instance is None:
        SUPABASE_URL = None
        SUPABASE_KEY = None

        # 1. Streamlit secrets (highest priority — overrides Railway plugin injections)
        try:
            import streamlit as st
            SUPABASE_URL = st.secrets["supabase"]["url"]
            SUPABASE_KEY = st.secrets["supabase"]["key"]
            print(f"Supabase credentials loaded from Streamlit secrets. URL={SUPABASE_URL[:40]}")
        except Exception:
            pass

        # 2. Environment variables (Railway custom vars or local)
        if not SUPABASE_URL or not SUPABASE_KEY:
            load_dotenv()
            SUPABASE_URL = os.environ.get("APP_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
            SUPABASE_KEY = os.environ.get("APP_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
            if SUPABASE_URL:
                print(f"Supabase credentials loaded from environment variables. URL={SUPABASE_URL[:40]}")

        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "Supabase credentials not found. Set them in Streamlit secrets or environment variables."
            )

        _supabase_client_instance = create_client(SUPABASE_URL, SUPABASE_KEY)

    return _supabase_client_instance
