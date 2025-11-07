"""
Vercel serverless function entry point for FastAPI backend
"""
import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

# Import the FastAPI app
from app import app

# Create Mangum adapter for Vercel
from mangum import Mangum

# Vercel expects this handler variable
handler = Mangum(app, lifespan="off")

