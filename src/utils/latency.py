import time
import functools
import datetime
import pandas as pd
import streamlit as st
from typing import Optional, List, Dict, Any

class LatencyMonitor:
    """
    Singleton class to collect latency metrics.
    Stores logs in st.session_state to ensure persistence across page navigation.
    """
    _instance = None
    _KEY = "latency_monitor_logs"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LatencyMonitor, cls).__new__(cls)
        return cls._instance

    def _get_storage(self) -> List[Dict[str, Any]]:
        """Helper to get storage from session state safely."""
        # Check if we are in a streamlit context context
        if hasattr(st, "session_state"):
            if self._KEY not in st.session_state:
                st.session_state[self._KEY] = []
            return st.session_state[self._KEY]
        else:
            # Fallback for testing outside streamlit
            if not hasattr(self, "_fallback_logs"):
                self._fallback_logs = []
            return self._fallback_logs

    def log_event(self, source: str, destination: str, operation: str, duration_ms: float, status: str = "OK", details: str = ""):
        """
        Record a latency event.
        """
        event = {
            "timestamp": datetime.datetime.now().isoformat(),
            "source": source,
            "destination": destination,
            "operation": operation,
            "duration_ms": round(duration_ms, 2),
            "status": status,
            "details": details
        }
        storage = self._get_storage()
        storage.append(event)
    
    def get_logs(self) -> List[Dict[str, Any]]:
        """Return all recorded logs."""
        return self._get_storage()

    def get_dataframe(self) -> pd.DataFrame:
        """Return logs as a pandas DataFrame."""
        logs = self.get_logs()
        if not logs:
            return pd.DataFrame(columns=["timestamp", "source", "destination", "operation", "duration_ms", "status", "details"])
        return pd.DataFrame(logs)

    def clear_logs(self):
        """Clear the current session logs."""
        if hasattr(st, "session_state"):
            st.session_state[self._KEY] = []
        if hasattr(self, "_fallback_logs"):
            self._fallback_logs = []

# Global instance
monitor = LatencyMonitor()

def measure_latency(source: str, destination: str, operation_name: Optional[str] = None):
    """
    Decorator to measure the execution time of a function.
    
    Args:
        source (str): The origin of the request (e.g., 'App').
        destination (str): The target system (e.g., 'Supabase', 'RUC API').
        operation_name (str, optional): Custom name for the operation. Defaults to function name.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation_name or func.__name__
            start_time = time.time()
            status = "OK"
            details = ""
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                status = "ERROR"
                details = str(e)
                raise e
            finally:
                end_time = time.time()
                duration_ms = (end_time - start_time) * 1000
                monitor.log_event(
                    source=source,
                    destination=destination,
                    operation=op_name,
                    duration_ms=duration_ms,
                    status=status,
                    details=details
                )
        return wrapper
    return decorator
