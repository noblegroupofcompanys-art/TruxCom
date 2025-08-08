from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
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
import hashlib
import jwt
import json
import asyncio
import random
import math

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

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id
        logging.info(f"WebSocket connected: {user_id} -> {connection_id}")
        return connection_id

    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        # Remove from user_connections
        for user_id, conn_id in list(self.user_connections.items()):
            if conn_id == connection_id:
                del self.user_connections[user_id]
                logging.info(f"WebSocket disconnected: {user_id}")
                break

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.user_connections:
            connection_id = self.user_connections[user_id]
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                try:
                    await websocket.send_text(json.dumps(message))
                except:
                    # Connection is dead, remove it
                    self.disconnect(connection_id)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except:
                dead_connections.append(connection_id)
        
        # Clean up dead connections
        for connection_id in dead_connections:
            self.disconnect(connection_id)

manager = ConnectionManager()

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
    password_hash: Optional[str] = None
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
    current_location: Optional[Dict] = None  # GPS coordinates
    route_progress: Optional[float] = 0.0  # Percentage completion

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

# GPS Tracking Models
class GPSLocation(BaseModel):
    shipment_id: str
    driver_id: str
    latitude: float
    longitude: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    speed: Optional[float] = 0.0  # km/h
    heading: Optional[float] = 0.0  # degrees

# Message Models
class MessageCreate(BaseModel):
    shipment_id: str
    content: str

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    sender_id: str
    sender_email: str
    sender_type: str  # 'shipper' or 'driver'
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read_by_recipient: bool = False

# Notification Models
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # 'bid_received', 'bid_accepted', 'shipment_update', 'message_received', 'location_alert'
    title: str
    message: str
    data: Optional[Dict] = {}  # Additional data for the notification
    read: bool = False
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

# Notification helper
async def create_notification(user_id: str, notification_type: str, title: str, message: str, data: Dict = {}):
    """Create and send a notification to a user"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data
    )
    
    # Save to database
    await db.notifications.insert_one(notification.dict())
    
    # Send real-time notification
    await manager.send_personal_message({
        "type": "notification",
        "data": notification.dict()
    }, user_id)

# Mock GPS data generator
def generate_mock_gps_route(origin: str, destination: str, progress: float = 0.0):
    """Generate mock GPS coordinates based on route progress"""
    # Mock coordinates for major cities (simplified)
    city_coords = {
        "New York, NY": {"lat": 40.7128, "lng": -74.0060},
        "Los Angeles, CA": {"lat": 34.0522, "lng": -118.2437},
        "Chicago, IL": {"lat": 41.8781, "lng": -87.6298},
        "Houston, TX": {"lat": 29.7604, "lng": -95.3698},
        "Miami, FL": {"lat": 25.7617, "lng": -80.1918},
        "Atlanta, GA": {"lat": 33.7490, "lng": -84.3880},
        "Denver, CO": {"lat": 39.7392, "lng": -104.9903},
        "Seattle, WA": {"lat": 47.6062, "lng": -122.3321}
    }
    
    # Get origin and destination coordinates
    origin_coords = city_coords.get(origin, {"lat": 40.7128, "lng": -74.0060})
    dest_coords = city_coords.get(destination, {"lat": 34.0522, "lng": -118.2437})
    
    # Calculate current position based on progress
    lat = origin_coords["lat"] + (dest_coords["lat"] - origin_coords["lat"]) * progress
    lng = origin_coords["lng"] + (dest_coords["lng"] - origin_coords["lng"]) * progress
    
    # Add some random variation to simulate realistic movement
    lat += random.uniform(-0.01, 0.01)
    lng += random.uniform(-0.01, 0.01)
    
    return {
        "latitude": lat,
        "longitude": lng,
        "speed": random.uniform(60, 80),  # km/h
        "heading": random.uniform(0, 360)
    }

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
        logger.info(f"Login failed: User not found for email {user_login.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if password_hash field exists (backward compatibility)
    password_hash = user.get("password_hash")
    logger.info(f"User found: {user.get('email')}, password_hash exists: {bool(password_hash)}")
    
    if not password_hash:
        logger.error(f"No password_hash found for user {user_login.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    is_valid = verify_password(user_login.password, password_hash)
    logger.info(f"Password verification result: {is_valid}")
    
    if not is_valid:
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
    
    # Send notification to shipper
    await create_notification(
        user_id=shipment["shipper_id"],
        notification_type="bid_received",
        title="New Bid Received",
        message=f"New bid of ${bid.bid_amount} received for your shipment",
        data={"bid_id": bid.id, "shipment_id": bid.shipment_id}
    )
    
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
    
    # Send notifications
    await create_notification(
        user_id=bid["driver_id"],
        notification_type="bid_accepted",
        title="Bid Accepted!",
        message=f"Your bid of ${bid['bid_amount']} has been accepted",
        data={"bid_id": bid_id, "shipment_id": bid["shipment_id"]}
    )
    
    return {"message": "Bid accepted successfully"}

@api_router.get("/my-bids", response_model=List[Bid])
async def get_my_bids(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view their bids")
    
    bids = await db.bids.find({"driver_id": current_user.id}).to_list(1000)
    return [Bid(**bid) for bid in bids]

# GPS Tracking Routes
@api_router.post("/gps/update")
async def update_gps_location(location: GPSLocation, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update GPS location")
    
    # Verify driver is assigned to this shipment
    shipment = await db.shipments.find_one({
        "id": location.shipment_id,
        "carrier_id": current_user.id
    })
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found or not assigned to you")
    
    # Save GPS location
    await db.gps_locations.insert_one(location.dict())
    
    # Update shipment's current location
    await db.shipments.update_one(
        {"id": location.shipment_id},
        {
            "$set": {
                "current_location": {
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "timestamp": location.timestamp.isoformat(),
                    "speed": location.speed,
                    "heading": location.heading
                }
            }
        }
    )
    
    # Send real-time update to shipper
    await manager.send_personal_message({
        "type": "location_update",
        "shipment_id": location.shipment_id,
        "location": {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "speed": location.speed,
            "heading": location.heading,
            "timestamp": location.timestamp.isoformat()
        }
    }, shipment["shipper_id"])
    
    return {"message": "GPS location updated"}

@api_router.get("/gps/shipment/{shipment_id}")
async def get_shipment_location(shipment_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to this shipment
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Only shipper or assigned driver can view location
    if (current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id) or \
       (current_user.user_type == UserRole.DRIVER and shipment.get("carrier_id") != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this shipment location")
    
    # Get latest location
    latest_location = await db.gps_locations.find_one(
        {"shipment_id": shipment_id},
        sort=[("timestamp", -1)]
    )
    
    if not latest_location:
        return {"message": "No location data available"}
    
    return GPSLocation(**latest_location)

# Messaging Routes
@api_router.post("/messages", response_model=Message)
async def send_message(message_create: MessageCreate, current_user: User = Depends(get_current_user)):
    # Check if user has access to this shipment
    shipment = await db.shipments.find_one({"id": message_create.shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Only shipper or assigned driver can send messages
    if (current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id) or \
       (current_user.user_type == UserRole.DRIVER and shipment.get("carrier_id") != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to send messages for this shipment")
    
    message_dict = message_create.dict()
    message_dict["sender_id"] = current_user.id
    message_dict["sender_email"] = current_user.email
    message_dict["sender_type"] = current_user.user_type
    
    message = Message(**message_dict)
    await db.messages.insert_one(message.dict())
    
    # Send real-time message to the other party
    recipient_id = shipment["carrier_id"] if current_user.user_type == UserRole.SHIPPER else shipment["shipper_id"]
    if recipient_id:
        await manager.send_personal_message({
            "type": "new_message",
            "data": message.dict()
        }, recipient_id)
        
        # Create notification for recipient
        await create_notification(
            user_id=recipient_id,
            notification_type="message_received",
            title="New Message",
            message=f"New message from {current_user.email}",
            data={"message_id": message.id, "shipment_id": message.shipment_id}
        )
    
    return message

@api_router.get("/messages/shipment/{shipment_id}", response_model=List[Message])
async def get_shipment_messages(shipment_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to this shipment
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Only shipper or assigned driver can view messages
    if (current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id) or \
       (current_user.user_type == UserRole.DRIVER and shipment.get("carrier_id") != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view messages for this shipment")
    
    messages = await db.messages.find({"shipment_id": shipment_id}).sort("timestamp", 1).to_list(1000)
    
    # Mark messages as read by recipient
    await db.messages.update_many(
        {
            "shipment_id": shipment_id,
            "sender_id": {"$ne": current_user.id}
        },
        {"$set": {"read_by_recipient": True}}
    )
    
    return [Message(**message) for message in messages]

# Notification Routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
    return [Notification(**notification) for notification in notifications]

@api_router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

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
        unread_notifications = await db.notifications.count_documents({
            "user_id": current_user.id,
            "read": False
        })
        
        return {
            "total_shipments": total_shipments,
            "pending_shipments": pending_shipments,
            "completed_shipments": completed_shipments,
            "active_shipments": total_shipments - completed_shipments,
            "unread_notifications": unread_notifications
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
        unread_notifications = await db.notifications.count_documents({
            "user_id": current_user.id,
            "read": False
        })
        
        return {
            "total_bids": total_bids,
            "accepted_bids": accepted_bids,
            "active_shipments": active_shipments,
            "completed_shipments": completed_shipments,
            "unread_notifications": unread_notifications
        }
    
    return {"error": "Invalid user type"}

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    connection_id = await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(connection_id)

# Background task for simulating GPS updates
async def simulate_gps_updates():
    """Background task to simulate GPS updates for in-transit shipments"""
    while True:
        try:
            # Find all in-transit shipments
            in_transit_shipments = await db.shipments.find({"status": "in_transit"}).to_list(100)
            
            for shipment in in_transit_shipments:
                if shipment.get("carrier_id"):
                    # Generate mock GPS data
                    current_progress = shipment.get("route_progress", 0.0)
                    new_progress = min(current_progress + random.uniform(0.01, 0.05), 1.0)  # Increment by 1-5%
                    
                    mock_location = generate_mock_gps_route(
                        shipment["origin_address"],
                        shipment["destination_address"],
                        new_progress
                    )
                    
                    # Update shipment location and progress
                    await db.shipments.update_one(
                        {"id": shipment["id"]},
                        {
                            "$set": {
                                "current_location": mock_location,
                                "route_progress": new_progress,
                                "status": "delivered" if new_progress >= 1.0 else "in_transit"
                            }
                        }
                    )
                    
                    # Send real-time update
                    await manager.send_personal_message({
                        "type": "location_update",
                        "shipment_id": shipment["id"],
                        "location": mock_location,
                        "progress": new_progress
                    }, shipment["shipper_id"])
                    
                    # If shipment is delivered, notify both parties
                    if new_progress >= 1.0:
                        await create_notification(
                            user_id=shipment["shipper_id"],
                            notification_type="shipment_delivered",
                            title="Shipment Delivered",
                            message=f"Your shipment has been delivered successfully",
                            data={"shipment_id": shipment["id"]}
                        )
                        
                        await create_notification(
                            user_id=shipment["carrier_id"],
                            notification_type="shipment_delivered",
                            title="Shipment Delivered",
                            message=f"You have successfully delivered the shipment",
                            data={"shipment_id": shipment["id"]}
                        )
            
            await asyncio.sleep(30)  # Update every 30 seconds
            
        except Exception as e:
            logging.error(f"Error in GPS simulation: {e}")
            await asyncio.sleep(30)

# Start background task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulate_gps_updates())

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