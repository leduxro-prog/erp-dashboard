"""
Main AI Agents API Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from b2b_chatbot.api import router as chatbot_router

app = FastAPI(
    title="Cypher ERP AI Agents",
    description="AI-powered services for Cypher ERP",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chatbot_router)

@app.get("/")
async def root():
    return {"message": "Cypher AI Agents API is running"}
