"""
Vercel serverless function entry point for FastAPI backend
Monorepo structure: imports from ../backend/
"""
import sys
import os

# Add backend directory to Python path (monorepo structure)
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

# Import the FastAPI app from backend directory
from app import app

# Vercel's Python runtime automatically detects FastAPI apps
# Export the app directly - Vercel handles ASGI internally
# The 'app' variable name is what Vercel looks for

