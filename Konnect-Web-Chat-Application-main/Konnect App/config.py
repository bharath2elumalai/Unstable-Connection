from dotenv import load_dotenv
from pathlib import Path  # python3 only
import os

# set path to env file
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)


class Config:
    """Set Flask configuration vars from .env file."""

    # Load in environment variables
    TESTING = os.getenv('TESTING', 'False')
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True')
    SECRET_KEY = os.getenv('SECRET_KEY', 'unstable_connection_secret_key_2026')
    SERVER = os.getenv('SERVER', '0.0.0.0')

    # Supabase Cloud Database Credentials
    SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://djusydxfxwvycqzcxxov.supabase.co')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdXN5ZHhmeHd2eWNxemN4eG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTIyNTYsImV4cCI6MjEwNzIyODI1Nn0.LGMA06gf5HKbU1CRhBugatoSNTiIMagrkUuPhcTgKoQ')
