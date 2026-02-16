"""
B2B Chatbot FastAPI Endpoints

Provides REST API for the B2B chatbot.
"""
from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .agent import B2BChatbotAgent

router = APIRouter(prefix="/chatbot", tags=["B2B Chatbot"])

# Global chatbot instance
_chatbot: Optional[B2BChatbotAgent] = None


class ChatRequest(BaseModel):
    """Chat request model"""
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response model"""
    response: str
    session_id: Optional[str] = None


def get_chatbot() -> B2BChatbotAgent:
    """Get or create the chatbot instance"""
    global _chatbot
    if _chatbot is None:
        _chatbot = B2BChatbotAgent(use_gemini=True)  # Use Gemini for cost savings
        _chatbot.initialize()
    return _chatbot


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Send a message to the B2B chatbot.
    
    Args:
        request: Chat request with message
        
    Returns:
        Chat response
    """
    try:
        chatbot = get_chatbot()
        response = chatbot.get_response(request.message)
        return ChatResponse(
            response=response,
            session_id=request.session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "b2b-chatbot"}
