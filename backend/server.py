from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
import hashlib
from datetime import datetime, timedelta
import jwt
# Remove passlib for now and use simple hashlib
# from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="TruxCom API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
SECRET_KEY = "truxcom-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
security = HTTPBearer()
# Temporarily use simple hash instead of bcrypt
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# User Models
class UserRole(str):
    SHIPPER = "shipper"
    DRIVER = "driver"
    ADMIN = "admin"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    phone_number: str
    user_type: str
    company_name: Optional[str] = None
    license_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone_number: str
    user_type: str
    company_name: Optional[str] = None
    license_number: Optional[str] = None
    kyc_status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Shipment Models
class ShipmentStatus(str):
    PENDING = "pending"
    BIDDING = "bidding"
    BOOKED = "booked"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class ShipmentCreate(BaseModel):
    origin_address: str
    destination_address: str
    cargo_description: str
    cargo_weight: float
    cargo_dimensions: str
    vehicle_type_required: str
    pickup_date: datetime
    delivery_deadline: datetime
    offered_price: float
    special_requirements: Optional[str] = None

class Shipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipper_id: str
    shipper_email: str
    carrier_id: Optional[str] = None
    origin_address: str
    destination_address: str
    cargo_description: str
    cargo_weight: float
    cargo_dimensions: str
    vehicle_type_required: str
    pickup_date: datetime
    delivery_deadline: datetime
    offered_price: float
    final_price: Optional[float] = None
    special_requirements: Optional[str] = None
    status: str = ShipmentStatus.BIDDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    booked_at: Optional[datetime] = None

# Bid Models
class BidCreate(BaseModel):
    shipment_id: str
    bid_amount: float
    message: Optional[str] = None
    estimated_pickup: datetime
    estimated_delivery: datetime

class Bid(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    driver_id: str
    driver_email: str
    bid_amount: float
    message: Optional[str] = None
    estimated_pickup: datetime
    estimated_delivery: datetime
    status: str = "submitted"
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Token Model
class Token(BaseModel):
    access_token: str
    token_type: str
    user_type: str
    user_id: str

# Utility functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Simple hash verification using hashlib
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password: str) -> str:
    # Simple hash using hashlib (temporary replacement for bcrypt)
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

# API Routes

@api_router.post("/auth/register", response_model=Token)
async def register_user(user_create: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_create.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_create.password)
    
    # Create user
    user_dict = user_create.dict()
    user_dict["password_hash"] = hashed_password
    del user_dict["password"]
    
    user = User(**user_dict)
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type=user.user_type,
        user_id=user.id
    )

@api_router.post("/auth/login", response_model=Token)
async def login_user(user_login: UserLogin):
    user = await db.users.find_one({"email": user_login.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if password_hash field exists (backward compatibility)
    password_hash = user.get("password_hash")
    if not password_hash or not verify_password(user_login.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type=user["user_type"],
        user_id=user["id"]
    )

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Shipment Routes
@api_router.post("/shipments", response_model=Shipment)
async def create_shipment(shipment_create: ShipmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.SHIPPER:
        raise HTTPException(status_code=403, detail="Only shippers can create shipments")
    
    shipment_dict = shipment_create.dict()
    shipment_dict["shipper_id"] = current_user.id
    shipment_dict["shipper_email"] = current_user.email
    
    shipment = Shipment(**shipment_dict)
    await db.shipments.insert_one(shipment.dict())
    
    return shipment

@api_router.get("/shipments", response_model=List[Shipment])
async def get_shipments(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    
    if current_user.user_type == UserRole.SHIPPER:
        query["shipper_id"] = current_user.id
    elif current_user.user_type == UserRole.DRIVER:
        # Drivers see available shipments (bidding status) or their booked ones
        if status:
            query["status"] = status
        else:
            query["$or"] = [
                {"status": ShipmentStatus.BIDDING},
                {"carrier_id": current_user.id}
            ]
    
    if status and current_user.user_type == UserRole.SHIPPER:
        query["status"] = status
    
    shipments = await db.shipments.find(query).to_list(1000)
    return [Shipment(**shipment) for shipment in shipments]

@api_router.get("/shipments/{shipment_id}", response_model=Shipment)
async def get_shipment(shipment_id: str, current_user: User = Depends(get_current_user)):
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    return Shipment(**shipment)

# Bid Routes
@api_router.post("/bids", response_model=Bid)
async def create_bid(bid_create: BidCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can create bids")
    
    # Check if shipment exists and is available for bidding
    shipment = await db.shipments.find_one({"id": bid_create.shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["status"] != ShipmentStatus.BIDDING:
        raise HTTPException(status_code=400, detail="Shipment is not available for bidding")
    
    # Check if user already bid on this shipment
    existing_bid = await db.bids.find_one({
        "shipment_id": bid_create.shipment_id,
        "driver_id": current_user.id
    })
    if existing_bid:
        raise HTTPException(status_code=400, detail="You have already placed a bid on this shipment")
    
    bid_dict = bid_create.dict()
    bid_dict["driver_id"] = current_user.id
    bid_dict["driver_email"] = current_user.email
    
    bid = Bid(**bid_dict)
    await db.bids.insert_one(bid.dict())
    
    return bid

@api_router.get("/bids/shipment/{shipment_id}", response_model=List[Bid])
async def get_shipment_bids(shipment_id: str, current_user: User = Depends(get_current_user)):
    # Only shipper of the shipment can view bids
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view bids for this shipment")
    
    bids = await db.bids.find({"shipment_id": shipment_id}).to_list(1000)
    return [Bid(**bid) for bid in bids]

@api_router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.SHIPPER:
        raise HTTPException(status_code=403, detail="Only shippers can accept bids")
    
    # Get the bid
    bid = await db.bids.find_one({"id": bid_id})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    
    # Get the shipment
    shipment = await db.shipments.find_one({"id": bid["shipment_id"]})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Verify shipper owns the shipment
    if shipment["shipper_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this bid")
    
    # Update shipment with accepted bid
    await db.shipments.update_one(
        {"id": bid["shipment_id"]},
        {
            "$set": {
                "status": ShipmentStatus.BOOKED,
                "carrier_id": bid["driver_id"],
                "final_price": bid["bid_amount"],
                "booked_at": datetime.utcnow()
            }
        }
    )
    
    # Update bid status
    await db.bids.update_one(
        {"id": bid_id},
        {"$set": {"status": "accepted"}}
    )
    
    # Reject all other bids for this shipment
    await db.bids.update_many(
        {"shipment_id": bid["shipment_id"], "id": {"$ne": bid_id}},
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Bid accepted successfully"}

@api_router.get("/my-bids", response_model=List[Bid])
async def get_my_bids(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view their bids")
    
    bids = await db.bids.find({"driver_id": current_user.id}).to_list(1000)
    return [Bid(**bid) for bid in bids]

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.user_type == UserRole.SHIPPER:
        total_shipments = await db.shipments.count_documents({"shipper_id": current_user.id})
        pending_shipments = await db.shipments.count_documents({
            "shipper_id": current_user.id,
            "status": {"$in": [ShipmentStatus.PENDING, ShipmentStatus.BIDDING]}
        })
        completed_shipments = await db.shipments.count_documents({
            "shipper_id": current_user.id,
            "status": ShipmentStatus.DELIVERED
        })
        
        return {
            "total_shipments": total_shipments,
            "pending_shipments": pending_shipments,
            "completed_shipments": completed_shipments,
            "active_shipments": total_shipments - completed_shipments
        }
    
    elif current_user.user_type == UserRole.DRIVER:
        total_bids = await db.bids.count_documents({"driver_id": current_user.id})
        accepted_bids = await db.bids.count_documents({
            "driver_id": current_user.id,
            "status": "accepted"
        })
        active_shipments = await db.shipments.count_documents({
            "carrier_id": current_user.id,
            "status": {"$in": [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT]}
        })
        completed_shipments = await db.shipments.count_documents({
            "carrier_id": current_user.id,
            "status": ShipmentStatus.DELIVERED
        })
        
        return {
            "total_bids": total_bids,
            "accepted_bids": accepted_bids,
            "active_shipments": active_shipments,
            "completed_shipments": completed_shipments
        }
    
    return {"error": "Invalid user type"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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