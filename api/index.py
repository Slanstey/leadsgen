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

# Create Mangum adapter for Vercel
from mangum import Mangum

# Vercel expects this handler variable
handler = Mangum(app, lifespan="off")

