from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets
import hashlib


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

# Email configuration (optional - for email verification)
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Chat Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Chat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    messages: List[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatCreate(BaseModel):
    title: str = "Neuer Chat"

class ChatUpdate(BaseModel):
    title: Optional[str] = None

class MessageAdd(BaseModel):
    role: str
    content: str

# User Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    google_id: str
    verified: bool = False
    verification_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None
    google_id: str

class UserLogin(BaseModel):
    google_token: str

# Helper Functions
def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None):
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)  # 30 days for persistent login
    
    to_encode = {"user_id": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("user_id")
        if user_id is None:
            return None
        return user_id
    except jwt.PyJWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = verify_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

def generate_verification_token():
    return secrets.token_urlsafe(32)

async def send_verification_email(email: str, token: str):
    """Send email verification (optional - requires SMTP configuration)"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.info(f"Email verification disabled. Token for {email}: {token}")
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = "E-Mail Bestätigung - Mr Ermin Chat"
        
        body = f"""
        Hallo!
        
        Bitte bestätigen Sie Ihre E-Mail-Adresse für den Mr Ermin Chat:
        
        Bestätigungscode: {token}
        
        Vielen Dank!
        Mr Ermin Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(SMTP_USERNAME, email, text)
        server.quit()
        
        logger.info(f"Verification email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send email to {email}: {str(e)}")

# Routes
# Original routes
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# User Authentication Routes
@api_router.post("/auth/login")
async def login_user(user_data: UserCreate):
    """Login or create user with Google OAuth data"""
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"google_id": user_data.google_id})
        
        if existing_user:
            user = User(**existing_user)
        else:
            # Create new user
            verification_token = generate_verification_token()
            user_dict = user_data.dict()
            user_obj = User(**user_dict, verification_token=verification_token)
            await db.users.insert_one(user_obj.dict())
            
            # Send verification email (optional)
            await send_verification_email(user_data.email, verification_token)
            user = user_obj
        
        # Create access token
        access_token = create_access_token(user.id)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "verified": user.verified
            }
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/verify-email")
async def verify_email(token: str):
    """Verify email with token"""
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$set": {"verified": True, "verification_token": None}}
    )
    
    return {"message": "Email verified successfully"}

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "verified": current_user.verified
    }

# Chat Routes
@api_router.get("/chats", response_model=List[Chat])
async def get_user_chats(current_user: User = Depends(get_current_user)):
    """Get all chats for the current user"""
    chats = await db.chats.find({"user_id": current_user.id}).sort("updated_at", -1).to_list(100)
    return [Chat(**chat) for chat in chats]

@api_router.post("/chats", response_model=Chat)
async def create_chat(chat_data: ChatCreate, current_user: User = Depends(get_current_user)):
    """Create a new chat"""
    chat_dict = chat_data.dict()
    chat_dict["user_id"] = current_user.id
    chat_obj = Chat(**chat_dict)
    await db.chats.insert_one(chat_obj.dict())
    return chat_obj

@api_router.get("/chats/{chat_id}", response_model=Chat)
async def get_chat(chat_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific chat"""
    chat = await db.chats.find_one({"id": chat_id, "user_id": current_user.id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return Chat(**chat)

@api_router.put("/chats/{chat_id}", response_model=Chat)
async def update_chat(chat_id: str, chat_update: ChatUpdate, current_user: User = Depends(get_current_user)):
    """Update chat title"""
    update_data = {k: v for k, v in chat_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.chats.update_one(
        {"id": chat_id, "user_id": current_user.id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    updated_chat = await db.chats.find_one({"id": chat_id, "user_id": current_user.id})
    return Chat(**updated_chat)

@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: User = Depends(get_current_user)):
    """Delete a chat"""
    result = await db.chats.delete_one({"id": chat_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"message": "Chat deleted successfully"}

@api_router.post("/chats/{chat_id}/messages")
async def add_message_to_chat(chat_id: str, message: MessageAdd, current_user: User = Depends(get_current_user)):
    """Add a message to a chat"""
    # Check if chat exists and belongs to user
    chat = await db.chats.find_one({"id": chat_id, "user_id": current_user.id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Create message
    chat_message = ChatMessage(role=message.role, content=message.content)
    
    # Update chat with new message
    await db.chats.update_one(
        {"id": chat_id, "user_id": current_user.id},
        {
            "$push": {"messages": chat_message.dict()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Message added successfully"}

@api_router.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str, current_user: User = Depends(get_current_user)):
    """Get messages from a chat"""
    chat = await db.chats.find_one({"id": chat_id, "user_id": current_user.id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return {"messages": chat.get("messages", [])}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
