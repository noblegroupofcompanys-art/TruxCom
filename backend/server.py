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
app = FastAPI(title="TruxCom API", version="2.0.0")

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
    EQUIPMENT_OWNER = "equipment_owner"
    WAREHOUSE_OPERATOR = "warehouse_operator"
    SERVICE_PROVIDER = "service_provider"
    ADMIN = "admin"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    phone_number: str
    user_type: str
    company_name: Optional[str] = None
    license_number: Optional[str] = None
    business_address: Optional[str] = None
    tax_id: Optional[str] = None

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
    business_address: Optional[str] = None
    tax_id: Optional[str] = None
    password_hash: Optional[str] = None
    kyc_status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    rating: float = 0.0
    total_reviews: int = 0
    verified_badges: List[str] = []
    trux_credit_balance: float = 0.0

# Shipment Models (Enhanced)
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
    insurance_required: bool = False
    cargo_value: Optional[float] = None

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
    insurance_required: bool = False
    cargo_value: Optional[float] = None
    status: str = ShipmentStatus.BIDDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    booked_at: Optional[datetime] = None
    current_location: Optional[Dict] = None
    route_progress: Optional[float] = 0.0
    estimated_distance: Optional[float] = None
    estimated_duration: Optional[float] = None
    fuel_cost: Optional[float] = None

# Equipment Models
class EquipmentType(str):
    TRUCK = "truck"
    TRAILER = "trailer"
    VAN = "van"
    FORKLIFT = "forklift"
    CRANE = "crane"
    EXCAVATOR = "excavator"
    CONTAINER = "container"
    FLATBED = "flatbed"
    REFRIGERATED = "refrigerated"

class EquipmentStatus(str):
    AVAILABLE = "available"
    RENTED = "rented"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"

class EquipmentCreate(BaseModel):
    name: str
    equipment_type: str
    brand: str
    model: str
    year: int
    specifications: Dict[str, Any]
    location: str
    rental_rate_hourly: float
    rental_rate_daily: float
    rental_rate_weekly: float
    rental_rate_monthly: float
    minimum_rental_period: str  # "hour", "day", "week", "month"
    description: str
    images: List[str] = []
    insurance_included: bool = False
    delivery_available: bool = False
    delivery_radius: Optional[float] = None
    delivery_fee: Optional[float] = None

class Equipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    owner_email: str
    name: str
    equipment_type: str
    brand: str
    model: str
    year: int
    specifications: Dict[str, Any]
    location: str
    rental_rate_hourly: float
    rental_rate_daily: float
    rental_rate_weekly: float
    rental_rate_monthly: float
    minimum_rental_period: str
    description: str
    images: List[str] = []
    insurance_included: bool = False
    delivery_available: bool = False
    delivery_radius: Optional[float] = None
    delivery_fee: Optional[float] = None
    status: str = EquipmentStatus.AVAILABLE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    rating: float = 0.0
    total_reviews: int = 0
    times_rented: int = 0
    maintenance_records: List[Dict] = []

class RentalCreate(BaseModel):
    equipment_id: str
    rental_period: str  # "hourly", "daily", "weekly", "monthly"
    rental_duration: int
    start_date: datetime
    delivery_required: bool = False
    delivery_address: Optional[str] = None
    special_instructions: Optional[str] = None

class Rental(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    equipment_id: str
    renter_id: str
    renter_email: str
    owner_id: str
    rental_period: str
    rental_duration: int
    start_date: datetime
    end_date: datetime
    total_cost: float
    delivery_required: bool = False
    delivery_address: Optional[str] = None
    delivery_fee: Optional[float] = None
    special_instructions: Optional[str] = None
    status: str = "confirmed"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    payment_status: str = "pending"

# Warehouse Models
class WarehouseType(str):
    AMBIENT = "ambient"
    CHILLED = "chilled"
    FROZEN = "frozen"
    HAZMAT = "hazmat"
    BULK = "bulk"

class WarehouseCreate(BaseModel):
    name: str
    address: str
    storage_types: List[str]
    capacity_sqm: float
    available_sqm: float
    features: List[str]  # dock_doors, forklifts, security, etc.
    pricing_per_sqm_monthly: float
    minimum_storage_period: str
    description: str
    images: List[str] = []
    operating_hours: str
    contact_person: str
    contact_phone: str
    services_offered: List[str] = []  # pick_pack, cross_dock, inventory_management

class Warehouse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    owner_email: str
    name: str
    address: str
    storage_types: List[str]
    capacity_sqm: float
    available_sqm: float
    features: List[str]
    pricing_per_sqm_monthly: float
    minimum_storage_period: str
    description: str
    images: List[str] = []
    operating_hours: str
    contact_person: str
    contact_phone: str
    services_offered: List[str] = []
    rating: float = 0.0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"

class StorageBookingCreate(BaseModel):
    warehouse_id: str
    storage_type: str
    required_sqm: float
    start_date: datetime
    duration_months: int
    cargo_description: str
    special_requirements: Optional[str] = None

class StorageBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    warehouse_id: str
    renter_id: str
    renter_email: str
    owner_id: str
    storage_type: str
    required_sqm: float
    start_date: datetime
    end_date: datetime
    monthly_cost: float
    total_cost: float
    cargo_description: str
    special_requirements: Optional[str] = None
    status: str = "confirmed"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    payment_status: str = "pending"

# Vehicle Sales Models
class VehicleCondition(str):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

class VehicleListingCreate(BaseModel):
    title: str
    vehicle_type: str
    brand: str
    model: str
    year: int
    mileage: float
    condition: str
    price: float
    location: str
    description: str
    specifications: Dict[str, Any]
    images: List[str] = []
    negotiable: bool = True
    financing_available: bool = False
    warranty_included: bool = False
    inspection_available: bool = False

class VehicleListing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    seller_email: str
    title: str
    vehicle_type: str
    brand: str
    model: str
    year: int
    mileage: float
    condition: str
    price: float
    location: str
    description: str
    specifications: Dict[str, Any]
    images: List[str] = []
    negotiable: bool = True
    financing_available: bool = False
    warranty_included: bool = False
    inspection_available: bool = False
    status: str = "active"
    views: int = 0
    inquiries: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    featured: bool = False

# Enhanced Bid Models
class BidCreate(BaseModel):
    shipment_id: str
    bid_amount: float
    message: Optional[str] = None
    estimated_pickup: datetime
    estimated_delivery: datetime
    auto_bid: bool = False
    max_auto_bid: Optional[float] = None

class Bid(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    driver_id: str
    driver_email: str
    bid_amount: float
    message: Optional[str] = None
    estimated_pickup: datetime
    estimated_delivery: datetime
    auto_bid: bool = False
    max_auto_bid: Optional[float] = None
    status: str = "submitted"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

# Payment Models
class TruxCreditTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    transaction_type: str  # "credit", "debit", "transfer"
    description: str
    related_id: Optional[str] = None  # shipment_id, rental_id, etc.
    payment_method: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    status: str = "completed"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str  # "trux_credit", "stripe"
    related_type: str  # "shipment", "rental", "storage", "vehicle"
    related_id: str
    stripe_payment_method_id: Optional[str] = None

# Enhanced Instapay System Models
class EscrowAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    shipper_id: str
    carrier_id: str
    amount: float
    currency: str = "USD"
    status: str = "pending"  # pending, funded, released, refunded, disputed
    funded_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    dispute_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    terms: Dict[str, Any] = {}  # Escrow terms and conditions
    milestone_conditions: List[Dict] = []  # Conditions for release

class EscrowCreate(BaseModel):
    shipment_id: str
    amount: float
    currency: str = "USD"
    payment_method: str  # "trux_credit", "stripe"
    milestone_conditions: List[Dict] = []
    stripe_payment_method_id: Optional[str] = None

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    issuer_id: str  # User who created the invoice
    recipient_id: str  # User who should pay
    related_type: str  # "shipment", "rental", "storage", "equipment"
    related_id: str
    items: List[Dict[str, Any]]  # Invoice line items
    subtotal: float
    tax_amount: float = 0.0
    total_amount: float
    currency: str = "USD"
    due_date: datetime
    status: str = "draft"  # draft, sent, paid, overdue, cancelled
    payment_terms: str = "Net 30"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    
class InvoiceCreate(BaseModel):
    recipient_id: str
    related_type: str
    related_id: str
    items: List[Dict[str, Any]]
    currency: str = "USD"
    due_date: datetime
    payment_terms: str = "Net 30"
    notes: Optional[str] = None

class MultiCurrencyRate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    base_currency: str = "USD"
    target_currency: str
    exchange_rate: float
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    source: str = "manual"  # manual, api, bank

class MultiCurrencyPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_amount: float
    original_currency: str
    converted_amount: float
    converted_currency: str
    exchange_rate: float
    conversion_fee: float = 0.0
    payment_id: str  # Reference to main payment
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Review Models
class ReviewCreate(BaseModel):
    related_type: str  # "shipment", "rental", "equipment", "warehouse", "vehicle"
    related_id: str
    reviewed_user_id: str
    rating: int  # 1-5
    comment: str
    categories: Optional[Dict[str, int]] = {}  # "communication": 5, "timeliness": 4, etc.

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reviewer_id: str
    reviewer_email: str
    related_type: str
    related_id: str
    reviewed_user_id: str
    rating: int
    comment: str
    categories: Optional[Dict[str, int]] = {}
    helpful_votes: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified: bool = False

# Analytics Models
class AnalyticsQuery(BaseModel):
    metric: str  # "revenue", "shipments", "users", "equipment_utilization", etc.
    time_range: str  # "7d", "30d", "90d", "1y"
    filters: Optional[Dict[str, Any]] = {}

# GPS Tracking Models (Enhanced)
class GPSLocation(BaseModel):
    shipment_id: str
    driver_id: str
    latitude: float
    longitude: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    speed: Optional[float] = 0.0
    heading: Optional[float] = 0.0
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    geofence_events: List[str] = []  # "entered_pickup", "left_pickup", "arrived_delivery"
    route_deviation_distance: Optional[float] = None  # meters off planned route
    temperature: Optional[float] = None  # for temperature monitoring

class GeofenceCreate(BaseModel):
    shipment_id: str
    name: str
    latitude: float
    longitude: float
    radius: float  # in meters
    event_type: str  # "pickup", "delivery", "rest_area", "checkpoint", "restricted_zone"
    alert_on_entry: bool = True
    alert_on_exit: bool = True
    notification_recipients: List[str] = []  # user IDs to notify

class Geofence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    name: str
    latitude: float
    longitude: float
    radius: float
    event_type: str
    alert_on_entry: bool = True
    alert_on_exit: bool = True
    notification_recipients: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    triggered_at: Optional[datetime] = None
    active: bool = True

class GeofenceEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    geofence_id: str
    shipment_id: str
    driver_id: str
    event_type: str  # "entry", "exit"
    location: Dict[str, float]  # {"latitude": x, "longitude": y}
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = False

class RouteDeviation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    driver_id: str
    deviation_distance: float  # meters
    deviation_duration: int  # seconds
    current_location: Dict[str, float]
    planned_route_point: Dict[str, float]
    severity: str  # "minor", "moderate", "major"
    acknowledged: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ETACalculation(BaseModel):
    shipment_id: str
    current_eta: datetime
    original_eta: datetime
    delay_minutes: int  # positive for delay, negative for early
    confidence: float  # 0.0 to 1.0
    factors: List[str]  # ["traffic", "weather", "route_change", "driver_break"]
    last_updated: datetime = Field(default_factory=datetime.utcnow)

# Message Models (Enhanced)
class MessageCreate(BaseModel):
    related_type: str  # "shipment", "rental", "equipment", "vehicle"
    related_id: str
    content: str
    message_type: str = "text"  # "text", "image", "document", "location"
    attachments: List[str] = []

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    related_type: str
    related_id: str
    sender_id: str
    sender_email: str
    sender_type: str
    recipient_id: str
    content: str
    message_type: str
    attachments: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read_by_recipient: bool = False
    delivered: bool = False

# Notification Models (Enhanced)
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[Dict] = {}
    channels: List[str] = ["in_app"]  # "in_app", "sms", "email", "push"
    read: bool = False
    delivered: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    priority: str = "normal"  # "low", "normal", "high", "urgent"

# Budget Management Models
class BudgetCreate(BaseModel):
    name: str
    budget_type: str  # "shipping", "equipment", "storage"
    total_amount: float
    period: str  # "weekly", "monthly", "quarterly", "yearly"
    auto_renew: bool = False
    alert_threshold: float = 80.0  # percentage

class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    budget_type: str
    total_amount: float
    spent_amount: float = 0.0
    remaining_amount: float = 0.0
    period: str
    period_start: datetime = Field(default_factory=datetime.utcnow)
    period_end: datetime
    auto_renew: bool = False
    alert_threshold: float = 80.0
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Token Model
class Token(BaseModel):
    access_token: str
    token_type: str
    user_type: str
    user_id: str

# Utility functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password: str) -> str:
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

@api_router.post("/gps/update", response_model=Dict[str, str])
async def update_gps_location(location_data: GPSLocation, current_user: User = Depends(get_current_user)):
    """Update GPS location with enhanced tracking features"""
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update GPS locations")
    
    # Verify the shipment belongs to the driver
    shipment = await db.shipments.find_one({"id": location_data.shipment_id})
    if not shipment or shipment.get("carrier_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update GPS for your assigned shipments")
    
    current_location = {
        "latitude": location_data.latitude,
        "longitude": location_data.longitude,
        "timestamp": location_data.timestamp
    }
    
    # Process geofence events
    geofence_events = await process_geofence_events(
        location_data.shipment_id, 
        current_location, 
        current_user.id
    )
    
    # Check for route deviation
    await check_route_deviation(location_data.shipment_id, current_location, current_user.id)
    
    # Update ETA calculation
    await update_eta(location_data.shipment_id, current_location)
    
    # Prepare enhanced location data
    location_dict = location_data.dict()
    location_dict["geofence_events"] = geofence_events
    
    # Calculate route deviation if planned route exists
    if shipment.get('planned_route'):
        deviation = calculate_route_deviation(
            location_data.latitude, location_data.longitude, shipment['planned_route']
        )
        location_dict["route_deviation_distance"] = deviation
    
    # Save GPS location
    await db.gps_locations.insert_one(location_dict)
    
    # Update shipment's current location and progress
    route_progress = calculate_route_progress(location_data, shipment)
    await db.shipments.update_one(
        {"id": location_data.shipment_id},
        {
            "$set": {
                "current_location": current_location,
                "route_progress": route_progress,
                "last_updated": datetime.utcnow()
            }
        }
    )
    
    # Send real-time update via WebSocket
    await manager.send_personal_message({
        "type": "gps_update",
        "data": {
            "shipment_id": location_data.shipment_id,
            "location": current_location,
            "route_progress": route_progress,
            "geofence_events": geofence_events,
            "route_deviation": location_dict.get("route_deviation_distance", 0)
        }
    }, shipment["shipper_id"])
    
    return {"status": "success", "message": "GPS location updated with enhanced tracking"}

@api_router.post("/shipments/{shipment_id}/geofences", response_model=Geofence)
async def create_geofence(shipment_id: str, geofence_create: GeofenceCreate, current_user: User = Depends(get_current_user)):
    """Create a geofence for a shipment"""
    # Verify shipment ownership
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["shipper_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only create geofences for your shipments")
    
    geofence_dict = geofence_create.dict()
    geofence_dict["shipment_id"] = shipment_id
    
    geofence = Geofence(**geofence_dict)
    await db.geofences.insert_one(geofence.dict())
    
    return geofence

@api_router.get("/shipments/{shipment_id}/geofences", response_model=List[Geofence])
async def get_shipment_geofences(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Get all geofences for a shipment"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Check if user has access to this shipment
    if shipment["shipper_id"] != current_user.id and shipment.get("carrier_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this shipment")
    
    geofences = await db.geofences.find({"shipment_id": shipment_id}).to_list(100)
    return [Geofence(**geofence) for geofence in geofences]

@api_router.get("/shipments/{shipment_id}/geofence-events", response_model=List[GeofenceEvent])
async def get_geofence_events(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Get geofence events for a shipment"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["shipper_id"] != current_user.id and shipment.get("carrier_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this shipment")
    
    events = await db.geofence_events.find({"shipment_id": shipment_id}).sort("timestamp", -1).to_list(100)
    return [GeofenceEvent(**event) for event in events]

@api_router.get("/shipments/{shipment_id}/route-deviations", response_model=List[RouteDeviation])
async def get_route_deviations(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Get route deviations for a shipment"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["shipper_id"] != current_user.id and shipment.get("carrier_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this shipment")
    
    deviations = await db.route_deviations.find({"shipment_id": shipment_id}).sort("created_at", -1).to_list(100)
    return [RouteDeviation(**deviation) for deviation in deviations]

@api_router.post("/shipments/{shipment_id}/route-deviations/{deviation_id}/acknowledge")
async def acknowledge_route_deviation(shipment_id: str, deviation_id: str, current_user: User = Depends(get_current_user)):
    """Acknowledge a route deviation alert"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["shipper_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the shipper can acknowledge route deviations")
    
    await db.route_deviations.update_one(
        {"id": deviation_id, "shipment_id": shipment_id},
        {"$set": {"acknowledged": True, "acknowledged_at": datetime.utcnow()}}
    )
    
    return {"status": "success", "message": "Route deviation acknowledged"}

@api_router.get("/shipments/{shipment_id}/eta", response_model=ETACalculation)
async def get_shipment_eta(shipment_id: str, current_user: User = Depends(get_current_user)):
    """Get current ETA calculation for a shipment"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if shipment["shipper_id"] != current_user.id and shipment.get("carrier_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this shipment")
    
    eta_calc = await db.eta_calculations.find_one({"shipment_id": shipment_id})
    if not eta_calc:
        raise HTTPException(status_code=404, detail="ETA calculation not available")
    
    return ETACalculation(**eta_calc)

def calculate_route_progress(location_data: GPSLocation, shipment: Dict) -> float:
    """Calculate route progress based on current location"""
    # Get origin and destination coordinates
    origin_coords = get_city_coordinates(shipment['origin_address'])
    dest_coords = get_city_coordinates(shipment['destination_address'])
    
    # Calculate total route distance
    total_distance = haversine_distance(
        origin_coords['latitude'], origin_coords['longitude'],
        dest_coords['latitude'], dest_coords['longitude']
    )
    
    # Calculate distance from origin to current location
    traveled_distance = haversine_distance(
        origin_coords['latitude'], origin_coords['longitude'],
        location_data.latitude, location_data.longitude
    )
    
    # Calculate progress as percentage
    if total_distance > 0:
        progress = min(1.0, traveled_distance / total_distance)
    else:
        progress = 0.0
    
    return progress

def calculate_route_optimization(origin: str, destination: str) -> Dict[str, float]:
    """Calculate optimized route metrics using real distance calculations"""
    origin_coords = get_city_coordinates(origin)
    dest_coords = get_city_coordinates(destination)
    
    if origin_coords['latitude'] == 0 or dest_coords['latitude'] == 0:
        # Fallback for unknown cities
        return {"distance": 500, "duration": 8, "fuel_cost": 65}
    
    # Calculate distance in km
    distance_km = haversine_distance(
        origin_coords['latitude'], origin_coords['longitude'],
        dest_coords['latitude'], dest_coords['longitude']
    ) / 1000
    
    # Estimate duration (assuming average speed of 65 km/h)
    duration_hours = distance_km / 65
    
    # Estimate fuel cost (assuming $0.12 per km)
    fuel_cost = distance_km * 0.12
    
    return {
        "distance": round(distance_km, 2),
        "duration": round(duration_hours, 2),
        "fuel_cost": round(fuel_cost, 2)
    }
async def create_notification(user_id: str, notification_type: str, title: str, message: str, 
                             data: Dict = {}, priority: str = "normal", channels: List[str] = ["in_app"]):
    """Create and send a notification to a user"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data,
        priority=priority,
        channels=channels
    )
    
    # Save to database
    await db.notifications.insert_one(notification.dict())
    
    # Send real-time notification
    await manager.send_personal_message({
        "type": "notification",
        "data": notification.dict()
    }, user_id)
    
    # TODO: Send SMS/Email notifications based on channels
    # This would integrate with Twilio/SendGrid for real notifications

# Instapay System Functions
async def create_escrow_for_shipment(shipment_id: str, shipper_id: str, carrier_id: str, 
                                   amount: float, currency: str = "USD", payment_method: str = "stripe",
                                   milestone_conditions: List[Dict] = None) -> EscrowAccount:
    """Create an escrow account for a shipment"""
    if milestone_conditions is None:
        milestone_conditions = [
            {"condition": "pickup_confirmed", "description": "Cargo picked up", "percentage": 0},
            {"condition": "delivery_confirmed", "description": "Cargo delivered", "percentage": 100}
        ]
    
    escrow = EscrowAccount(
        shipment_id=shipment_id,
        shipper_id=shipper_id,
        carrier_id=carrier_id,
        amount=amount,
        currency=currency,
        milestone_conditions=milestone_conditions,
        terms={
            "payment_method": payment_method,
            "dispute_period": 7,  # days
            "auto_release": True
        }
    )
    
    await db.escrow_accounts.insert_one(escrow.dict())
    
    # Send notifications
    await create_notification(
        shipper_id,
        "escrow_created",
        "Escrow Account Created",
        f"Escrow account created for ${amount} {currency}",
        {"escrow_id": escrow.id, "shipment_id": shipment_id},
        priority="normal"
    )
    
    await create_notification(
        carrier_id,
        "escrow_created",
        "Payment Secured in Escrow",
        f"${amount} {currency} secured in escrow for your shipment",
        {"escrow_id": escrow.id, "shipment_id": shipment_id},
        priority="normal"
    )
    
    return escrow

async def fund_escrow_account(escrow_id: str, payment_method_id: str = None) -> bool:
    """Fund an escrow account"""
    escrow = await db.escrow_accounts.find_one({"id": escrow_id})
    if not escrow:
        return False
    
    # Simulate payment processing (in real app, integrate with Stripe)
    success = await process_payment(
        amount=escrow["amount"],
        currency=escrow["currency"],
        payment_method=escrow["terms"].get("payment_method", "stripe"),
        payment_method_id=payment_method_id
    )
    
    if success:
        await db.escrow_accounts.update_one(
            {"id": escrow_id},
            {
                "$set": {
                    "status": "funded",
                    "funded_at": datetime.utcnow()
                }
            }
        )
        
        # Notify carrier that funds are secured
        await create_notification(
            escrow["carrier_id"],
            "escrow_funded",
            "Escrow Account Funded",
            f"${escrow['amount']} {escrow['currency']} is now secured in escrow",
            {"escrow_id": escrow_id, "shipment_id": escrow["shipment_id"]},
            priority="normal"
        )
        
        return True
    
    return False

async def release_escrow_funds(escrow_id: str, release_percentage: float = 100.0, reason: str = "delivery_confirmed") -> bool:
    """Release funds from escrow to carrier"""
    escrow = await db.escrow_accounts.find_one({"id": escrow_id})
    if not escrow or escrow["status"] != "funded":
        return False
    
    release_amount = (escrow["amount"] * release_percentage) / 100.0
    
    # Transfer funds to carrier's TruxCredit wallet
    await db.users.update_one(
        {"id": escrow["carrier_id"]},
        {"$inc": {"trux_credit_balance": release_amount}}
    )
    
    # Record transaction
    transaction = TruxCreditTransaction(
        user_id=escrow["carrier_id"],
        amount=release_amount,
        transaction_type="credit",
        description=f"Escrow release - {reason}",
        related_id=escrow["shipment_id"]
    )
    await db.trux_credit_transactions.insert_one(transaction.dict())
    
    # Update escrow status
    await db.escrow_accounts.update_one(
        {"id": escrow_id},
        {
            "$set": {
                "status": "released" if release_percentage >= 100 else "partial_release",
                "released_at": datetime.utcnow()
            }
        }
    )
    
    # Send notifications
    await create_notification(
        escrow["carrier_id"],
        "escrow_released",
        "Payment Released",
        f"${release_amount} {escrow['currency']} released to your account",
        {"escrow_id": escrow_id, "amount": release_amount},
        priority="normal"
    )
    
    await create_notification(
        escrow["shipper_id"],
        "escrow_released",
        "Payment Released to Carrier",
        f"${release_amount} {escrow['currency']} released from escrow",
        {"escrow_id": escrow_id, "amount": release_amount},
        priority="normal"
    )
    
    return True

async def process_payment(amount: float, currency: str, payment_method: str, payment_method_id: str = None) -> bool:
    """Process payment (mock implementation - integrate with Stripe in production)"""
    # Simulate payment processing delay
    await asyncio.sleep(0.1)
    
    # Mock success rate (95% success in simulation)
    success_rate = 0.95
    return random.random() < success_rate

async def generate_invoice(invoice_create: InvoiceCreate, issuer_id: str) -> Invoice:
    """Generate an invoice"""
    # Calculate amounts
    subtotal = sum(item.get('amount', 0) for item in invoice_create.items)
    tax_rate = 0.08  # 8% tax rate (should be configurable)
    tax_amount = subtotal * tax_rate
    total_amount = subtotal + tax_amount
    
    # Generate invoice number
    invoice_count = await db.invoices.count_documents({}) + 1
    invoice_number = f"INV-{datetime.utcnow().year}-{invoice_count:06d}"
    
    invoice_dict = invoice_create.dict()
    invoice_dict.update({
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "issuer_id": issuer_id,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "status": "draft"
    })
    
    invoice = Invoice(**invoice_dict)
    await db.invoices.insert_one(invoice.dict())
    
    return invoice

async def send_invoice(invoice_id: str) -> bool:
    """Send an invoice to the recipient"""
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        return False
    
    # Update status to sent
    await db.invoices.update_one(
        {"id": invoice_id},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.utcnow()
            }
        }
    )
    
    # Send notification to recipient
    await create_notification(
        invoice["recipient_id"],
        "invoice_received",
        "Invoice Received",
        f"New invoice {invoice['invoice_number']} for ${invoice['total_amount']} {invoice['currency']}",
        {"invoice_id": invoice_id, "amount": invoice["total_amount"]},
        priority="normal",
        channels=["in_app", "email"]
    )
    
    return True

async def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    """Get exchange rate between currencies (mock implementation)"""
    # Mock exchange rates (in production, use real API like exchangerate-api.com)
    mock_rates = {
        ("USD", "EUR"): 0.85,
        ("USD", "GBP"): 0.73,
        ("USD", "CAD"): 1.25,
        ("USD", "JPY"): 110.0,
        ("EUR", "USD"): 1.18,
        ("GBP", "USD"): 1.37,
        ("CAD", "USD"): 0.80,
        ("JPY", "USD"): 0.009
    }
    
    if from_currency == to_currency:
        return 1.0
    
    rate = mock_rates.get((from_currency, to_currency))
    if rate:
        return rate
    
    # Try reverse rate
    reverse_rate = mock_rates.get((to_currency, from_currency))
    if reverse_rate:
        return 1.0 / reverse_rate
    
    # Default to 1.0 if rate not found
    return 1.0

async def convert_currency(amount: float, from_currency: str, to_currency: str) -> Dict[str, float]:
    """Convert amount from one currency to another"""
    if from_currency == to_currency:
        return {
            "original_amount": amount,
            "converted_amount": amount,
            "exchange_rate": 1.0,
            "conversion_fee": 0.0
        }
    
    exchange_rate = await get_exchange_rate(from_currency, to_currency)
    converted_amount = amount * exchange_rate
    
    # Calculate conversion fee (1% for currency conversion)
    conversion_fee = converted_amount * 0.01
    
    return {
        "original_amount": amount,
        "converted_amount": converted_amount,
        "exchange_rate": exchange_rate,
        "conversion_fee": conversion_fee
    }

# Pricing calculation helpers
def calculate_dynamic_price(base_price: float, demand_factor: float, supply_factor: float, 
                          distance: float, urgency_factor: float) -> float:
    """Calculate dynamic pricing based on market conditions"""
    # Dynamic pricing algorithm
    demand_multiplier = 1.0 + (demand_factor - 1.0) * 0.5  # Cap demand impact
    supply_multiplier = 1.0 + (1.0 - supply_factor) * 0.3  # Cap supply impact
    distance_multiplier = 1.0 + (distance / 1000) * 0.1  # Distance impact
    urgency_multiplier = 1.0 + urgency_factor * 0.2  # Urgency impact
    
    dynamic_price = base_price * demand_multiplier * supply_multiplier * distance_multiplier * urgency_multiplier
    return round(dynamic_price, 2)

# Geofencing and Route Optimization Utilities

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on Earth in meters"""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def is_location_in_geofence(lat: float, lon: float, geofence_lat: float, geofence_lon: float, radius: float) -> bool:
    """Check if a location is within a geofence"""
    distance = haversine_distance(lat, lon, geofence_lat, geofence_lon)
    return distance <= radius

def calculate_route_deviation(current_lat: float, current_lon: float, planned_route: List[Dict]) -> float:
    """Calculate minimum distance from current location to planned route"""
    if not planned_route:
        return 0.0
    
    min_distance = float('inf')
    for point in planned_route:
        distance = haversine_distance(current_lat, current_lon, point['latitude'], point['longitude'])
        min_distance = min(min_distance, distance)
    
    return min_distance

def calculate_eta(current_location: Dict, destination: Dict, average_speed_kmh: float = 60, 
                 traffic_factor: float = 1.0, weather_factor: float = 1.0) -> datetime:
    """Calculate estimated time of arrival based on current location"""
    distance_km = haversine_distance(
        current_location['latitude'], current_location['longitude'],
        destination['latitude'], destination['longitude']
    ) / 1000
    
    # Apply factors for traffic and weather conditions
    adjusted_speed = average_speed_kmh * traffic_factor * weather_factor
    
    # Ensure minimum speed to avoid division by zero
    adjusted_speed = max(adjusted_speed, 10)
    
    travel_time_hours = distance_km / adjusted_speed
    travel_time_minutes = travel_time_hours * 60
    
    return datetime.utcnow() + timedelta(minutes=travel_time_minutes)

def get_route_deviation_severity(deviation_distance: float) -> str:
    """Determine severity of route deviation"""
    if deviation_distance < 500:  # < 500m
        return "minor"
    elif deviation_distance < 2000:  # < 2km
        return "moderate"
    else:
        return "major"

async def process_geofence_events(shipment_id: str, current_location: Dict, driver_id: str):
    """Process geofence events for a shipment"""
    # Get active geofences for this shipment
    geofences = await db.geofences.find({
        "shipment_id": shipment_id,
        "active": True
    }).to_list(100)
    
    events_triggered = []
    
    for geofence in geofences:
        is_inside = is_location_in_geofence(
            current_location['latitude'], current_location['longitude'],
            geofence['latitude'], geofence['longitude'],
            geofence['radius']
        )
        
        # Check if driver was previously inside/outside
        last_location = await db.gps_locations.find_one(
            {"shipment_id": shipment_id, "driver_id": driver_id},
            sort=[("timestamp", -1)]
        )
        
        was_inside = False
        if last_location and last_location.get('geofence_events'):
            was_inside = f"inside_{geofence['id']}" in last_location['geofence_events']
        
        # Detect entry/exit events
        if is_inside and not was_inside and geofence['alert_on_entry']:
            # Entry event
            event = GeofenceEvent(
                geofence_id=geofence['id'],
                shipment_id=shipment_id,
                driver_id=driver_id,
                event_type="entry",
                location=current_location
            )
            await db.geofence_events.insert_one(event.dict())
            events_triggered.append(f"entered_{geofence['event_type']}")
            
            # Send notifications
            for recipient_id in geofence.get('notification_recipients', []):
                await create_notification(
                    recipient_id,
                    "geofence_entry",
                    f"Geofence Entry Alert",
                    f"Driver has entered {geofence['name']} geofence",
                    {"geofence_id": geofence['id'], "shipment_id": shipment_id},
                    priority="normal",
                    channels=["in_app", "sms"]
                )
        
        elif not is_inside and was_inside and geofence['alert_on_exit']:
            # Exit event
            event = GeofenceEvent(
                geofence_id=geofence['id'],
                shipment_id=shipment_id,
                driver_id=driver_id,
                event_type="exit",
                location=current_location
            )
            await db.geofence_events.insert_one(event.dict())
            events_triggered.append(f"exited_{geofence['event_type']}")
            
            # Send notifications
            for recipient_id in geofence.get('notification_recipients', []):
                await create_notification(
                    recipient_id,
                    "geofence_exit",
                    f"Geofence Exit Alert",
                    f"Driver has exited {geofence['name']} geofence",
                    {"geofence_id": geofence['id'], "shipment_id": shipment_id},
                    priority="normal",
                    channels=["in_app", "sms"]
                )
        
        # Mark current state
        if is_inside:
            events_triggered.append(f"inside_{geofence['id']}")
    
    return events_triggered

async def check_route_deviation(shipment_id: str, current_location: Dict, driver_id: str):
    """Check for route deviation and create alerts if necessary"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment or not shipment.get('planned_route'):
        return
    
    deviation_distance = calculate_route_deviation(
        current_location['latitude'],
        current_location['longitude'],
        shipment['planned_route']
    )
    
    # Check if deviation exceeds threshold (500m for minor alert)
    if deviation_distance > 500:
        severity = get_route_deviation_severity(deviation_distance)
        
        # Check if we already have a recent unacknowledged deviation
        recent_deviation = await db.route_deviations.find_one({
            "shipment_id": shipment_id,
            "acknowledged": False,
            "created_at": {"$gte": datetime.utcnow() - timedelta(minutes=30)}
        })
        
        if not recent_deviation:
            # Create new deviation alert
            deviation = RouteDeviation(
                shipment_id=shipment_id,
                driver_id=driver_id,
                deviation_distance=deviation_distance,
                deviation_duration=0,  # Will be calculated later
                current_location=current_location,
                planned_route_point={},  # Closest planned route point
                severity=severity
            )
            await db.route_deviations.insert_one(deviation.dict())
            
            # Send notifications based on severity
            priority = "normal" if severity == "minor" else "high" if severity == "moderate" else "urgent"
            
            # Notify shipper
            await create_notification(
                shipment['shipper_id'],
                "route_deviation",
                f"{severity.title()} Route Deviation",
                f"Driver is {int(deviation_distance)}m off planned route",
                {"deviation_id": deviation.id, "shipment_id": shipment_id, "severity": severity},
                priority=priority,
                channels=["in_app", "sms"] if severity != "minor" else ["in_app"]
            )

async def update_eta(shipment_id: str, current_location: Dict):
    """Update ETA calculation for a shipment"""
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        return
    
    # Get destination coordinates (mock - in real app would use geocoding)
    destination_coords = get_city_coordinates(shipment['destination_address'])
    
    # Calculate new ETA with various factors
    traffic_factor = random.uniform(0.8, 1.2)  # Mock traffic conditions
    weather_factor = random.uniform(0.9, 1.1)  # Mock weather conditions
    
    new_eta = calculate_eta(
        current_location,
        destination_coords,
        average_speed_kmh=65,
        traffic_factor=traffic_factor,
        weather_factor=weather_factor
    )
    
    # Get original ETA from shipment
    original_eta = shipment['delivery_deadline']
    if isinstance(original_eta, str):
        original_eta = datetime.fromisoformat(original_eta.replace('Z', '+00:00'))
    
    delay_minutes = int((new_eta - original_eta).total_seconds() / 60)
    
    # Calculate confidence based on distance to destination
    distance_km = haversine_distance(
        current_location['latitude'], current_location['longitude'],
        destination_coords['latitude'], destination_coords['longitude']
    ) / 1000
    
    # Higher confidence for shorter distances
    confidence = max(0.5, 1.0 - (distance_km / 1000))
    
    eta_calc = ETACalculation(
        shipment_id=shipment_id,
        current_eta=new_eta,
        original_eta=original_eta,
        delay_minutes=delay_minutes,
        confidence=confidence,
        factors=["traffic", "weather"] if traffic_factor != 1.0 or weather_factor != 1.0 else []
    )
    
    # Update or insert ETA calculation
    await db.eta_calculations.replace_one(
        {"shipment_id": shipment_id},
        eta_calc.dict(),
        upsert=True
    )
    
    # Send delay notifications if significant
    if delay_minutes > 30:  # More than 30 minutes delay
        await create_notification(
            shipment['shipper_id'],
            "eta_delay",
            "Delivery Delay Alert",
            f"Shipment delivery delayed by {delay_minutes} minutes",
            {"shipment_id": shipment_id, "delay_minutes": delay_minutes},
            priority="normal",
            channels=["in_app", "sms"]
        )

def get_city_coordinates(city_name: str) -> Dict[str, float]:
    """Mock function to get city coordinates - in real app would use geocoding API"""
    city_coords = {
        "New York, NY": {"latitude": 40.7128, "longitude": -74.0060},
        "Los Angeles, CA": {"latitude": 34.0522, "longitude": -118.2437},
        "Chicago, IL": {"latitude": 41.8781, "longitude": -87.6298},
        "Houston, TX": {"latitude": 29.7604, "longitude": -95.3698},
        "Miami, FL": {"latitude": 25.7617, "longitude": -80.1918},
        "Atlanta, GA": {"latitude": 33.7490, "longitude": -84.3880},
        "Denver, CO": {"latitude": 39.7392, "longitude": -104.9903},
        "Seattle, WA": {"latitude": 47.6062, "longitude": -122.3321},
    }
    return city_coords.get(city_name, {"latitude": 0.0, "longitude": 0.0})

def calculate_route_optimization(origin: str, destination: str) -> Dict[str, float]:
    """Calculate optimized route metrics using city coordinates"""
    # Get coordinates for origin and destination
    origin_coords = get_city_coordinates(origin)
    dest_coords = get_city_coordinates(destination)
    
    # Calculate distance using haversine formula
    distance_meters = haversine_distance(
        origin_coords['latitude'], origin_coords['longitude'],
        dest_coords['latitude'], dest_coords['longitude']
    )
    distance_km = distance_meters / 1000
    
    # Estimate duration based on average highway speed (65 km/h)
    duration_hours = distance_km / 65
    
    # Estimate fuel cost (rough calculation: $0.15 per km)
    fuel_cost = distance_km * 0.15
    
    return {
        "distance": distance_km,
        "duration": duration_hours,
        "fuel_cost": fuel_cost
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
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

# Shipment Routes (Enhanced)
@api_router.post("/shipments", response_model=Shipment)
async def create_shipment(shipment_create: ShipmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.SHIPPER:
        raise HTTPException(status_code=403, detail="Only shippers can create shipments")
    
    shipment_dict = shipment_create.dict()
    shipment_dict["shipper_id"] = current_user.id
    shipment_dict["shipper_email"] = current_user.email
    
    # Calculate route optimization
    route_data = calculate_route_optimization(
        shipment_create.origin_address,
        shipment_create.destination_address
    )
    shipment_dict.update(route_data)
    
    # Apply dynamic pricing
    demand_factor = random.uniform(0.8, 1.5)  # Mock demand
    supply_factor = random.uniform(0.5, 1.2)  # Mock supply
    urgency = (shipment_create.delivery_deadline - datetime.utcnow()).days
    urgency_factor = max(0, (7 - urgency) / 7)  # Higher urgency = higher multiplier
    
    dynamic_price = calculate_dynamic_price(
        shipment_create.offered_price,
        demand_factor,
        supply_factor,
        route_data["distance"],
        urgency_factor
    )
    
    shipment_dict["offered_price"] = dynamic_price
    
    shipment = Shipment(**shipment_dict)
    await db.shipments.insert_one(shipment.dict())
    
    return shipment

@api_router.get("/shipments", response_model=List[Shipment])
async def get_shipments(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    
    if current_user.user_type == UserRole.SHIPPER:
        query["shipper_id"] = current_user.id
    elif current_user.user_type == UserRole.DRIVER:
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

# Equipment Routes
@api_router.post("/equipment", response_model=Equipment)
async def create_equipment(equipment_create: EquipmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.EQUIPMENT_OWNER:
        raise HTTPException(status_code=403, detail="Only equipment owners can create equipment listings")
    
    equipment_dict = equipment_create.dict()
    equipment_dict["owner_id"] = current_user.id
    equipment_dict["owner_email"] = current_user.email
    
    equipment = Equipment(**equipment_dict)
    await db.equipment.insert_one(equipment.dict())
    
    return equipment

@api_router.get("/equipment", response_model=List[Equipment])
async def get_equipment(
    equipment_type: Optional[str] = None,
    location: Optional[str] = None,
    available_only: bool = True,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    if available_only:
        query["status"] = EquipmentStatus.AVAILABLE
    
    if equipment_type:
        query["equipment_type"] = equipment_type
    
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    equipment_list = await db.equipment.find(query).to_list(1000)
    return [Equipment(**equipment) for equipment in equipment_list]

@api_router.post("/equipment/{equipment_id}/rent", response_model=Rental)
async def rent_equipment(equipment_id: str, rental_create: RentalCreate, current_user: User = Depends(get_current_user)):
    # Check if equipment exists and is available
    equipment = await db.equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    if equipment["status"] != EquipmentStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Equipment is not available for rent")
    
    # Calculate rental cost
    rate_map = {
        "hourly": equipment["rental_rate_hourly"],
        "daily": equipment["rental_rate_daily"],
        "weekly": equipment["rental_rate_weekly"],
        "monthly": equipment["rental_rate_monthly"]
    }
    
    rate = rate_map.get(rental_create.rental_period, equipment["rental_rate_daily"])
    total_cost = rate * rental_create.rental_duration
    
    # Add delivery fee if required
    delivery_fee = 0
    if rental_create.delivery_required and equipment["delivery_available"]:
        delivery_fee = equipment.get("delivery_fee", 0)
        total_cost += delivery_fee
    
    # Calculate end date
    duration_map = {
        "hourly": timedelta(hours=rental_create.rental_duration),
        "daily": timedelta(days=rental_create.rental_duration),
        "weekly": timedelta(weeks=rental_create.rental_duration),
        "monthly": timedelta(days=rental_create.rental_duration * 30)
    }
    
    end_date = rental_create.start_date + duration_map[rental_create.rental_period]
    
    # Create rental
    rental_dict = rental_create.dict()
    rental_dict.update({
        "renter_id": current_user.id,
        "renter_email": current_user.email,
        "owner_id": equipment["owner_id"],
        "end_date": end_date,
        "total_cost": total_cost,
        "delivery_fee": delivery_fee if rental_create.delivery_required else None
    })
    
    rental = Rental(**rental_dict)
    await db.rentals.insert_one(rental.dict())
    
    # Update equipment status
    await db.equipment.update_one(
        {"id": equipment_id},
        {"$set": {"status": EquipmentStatus.RENTED}}
    )
    
    # Send notifications
    await create_notification(
        equipment["owner_id"],
        "rental_request",
        "New Equipment Rental",
        f"Your {equipment['name']} has been rented for {rental_create.rental_duration} {rental_create.rental_period}",
        {"rental_id": rental.id, "equipment_id": equipment_id}
    )
    
    return rental

# Warehouse Routes
@api_router.post("/warehouses", response_model=Warehouse)
async def create_warehouse(warehouse_create: WarehouseCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.WAREHOUSE_OPERATOR:
        raise HTTPException(status_code=403, detail="Only warehouse operators can create warehouse listings")
    
    warehouse_dict = warehouse_create.dict()
    warehouse_dict["owner_id"] = current_user.id
    warehouse_dict["owner_email"] = current_user.email
    
    warehouse = Warehouse(**warehouse_dict)
    await db.warehouses.insert_one(warehouse.dict())
    
    return warehouse

@api_router.get("/warehouses", response_model=List[Warehouse])
async def get_warehouses(
    storage_type: Optional[str] = None,
    location: Optional[str] = None,
    min_capacity: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"status": "active"}
    
    if storage_type:
        query["storage_types"] = {"$in": [storage_type]}
    
    if location:
        query["address"] = {"$regex": location, "$options": "i"}
    
    if min_capacity:
        query["available_sqm"] = {"$gte": min_capacity}
    
    warehouses = await db.warehouses.find(query).to_list(1000)
    return [Warehouse(**warehouse) for warehouse in warehouses]

@api_router.post("/warehouses/{warehouse_id}/book", response_model=StorageBooking)
async def book_warehouse_storage(warehouse_id: str, booking_create: StorageBookingCreate, current_user: User = Depends(get_current_user)):
    # Check if warehouse exists
    warehouse = await db.warehouses.find_one({"id": warehouse_id})
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Check availability
    if warehouse["available_sqm"] < booking_create.required_sqm:
        raise HTTPException(status_code=400, detail="Insufficient storage space available")
    
    # Calculate costs
    end_date = booking_create.start_date + timedelta(days=booking_create.duration_months * 30)
    monthly_cost = booking_create.required_sqm * warehouse["pricing_per_sqm_monthly"]
    total_cost = monthly_cost * booking_create.duration_months
    
    # Create booking
    booking_dict = booking_create.dict()
    booking_dict.update({
        "renter_id": current_user.id,
        "renter_email": current_user.email,
        "owner_id": warehouse["owner_id"],
        "end_date": end_date,
        "monthly_cost": monthly_cost,
        "total_cost": total_cost
    })
    
    booking = StorageBooking(**booking_dict)
    await db.storage_bookings.insert_one(booking.dict())
    
    # Update warehouse availability
    await db.warehouses.update_one(
        {"id": warehouse_id},
        {"$inc": {"available_sqm": -booking_create.required_sqm}}
    )
    
    # Send notification
    await create_notification(
        warehouse["owner_id"],
        "storage_booking",
        "New Storage Booking",
        f"New booking for {booking_create.required_sqm} sqm at your {warehouse['name']} warehouse",
        {"booking_id": booking.id, "warehouse_id": warehouse_id}
    )
    
    return booking

# Vehicle Sales Routes
@api_router.post("/vehicles", response_model=VehicleListing)
async def create_vehicle_listing(listing_create: VehicleListingCreate, current_user: User = Depends(get_current_user)):
    listing_dict = listing_create.dict()
    listing_dict["seller_id"] = current_user.id
    listing_dict["seller_email"] = current_user.email
    
    listing = VehicleListing(**listing_dict)
    await db.vehicle_listings.insert_one(listing.dict())
    
    return listing

@api_router.get("/vehicles", response_model=List[VehicleListing])
async def get_vehicle_listings(
    vehicle_type: Optional[str] = None,
    brand: Optional[str] = None,
    max_price: Optional[float] = None,
    location: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"status": "active"}
    
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    
    if max_price:
        query["price"] = {"$lte": max_price}
    
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    listings = await db.vehicle_listings.find(query).to_list(1000)
    return [VehicleListing(**listing) for listing in listings]

# Enhanced Bidding Routes
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
    
    # Set expiration for auto-bids
    if bid_create.auto_bid:
        bid_dict["expires_at"] = datetime.utcnow() + timedelta(hours=24)
    
    bid = Bid(**bid_dict)
    await db.bids.insert_one(bid.dict())
    
    # Send notification to shipper
    await create_notification(
        user_id=shipment["shipper_id"],
        notification_type="bid_received",
        title="New Bid Received",
        message=f"New bid of ${bid.bid_amount} received for your shipment",
        data={"bid_id": bid.id, "shipment_id": bid.shipment_id},
        channels=["in_app", "sms"]  # Send both in-app and SMS
    )
    
    return bid

@api_router.get("/bids/shipment/{shipment_id}", response_model=List[Bid])
async def get_shipment_bids(shipment_id: str, current_user: User = Depends(get_current_user)):
    shipment = await db.shipments.find_one({"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    if current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view bids for this shipment")
    
    bids = await db.bids.find({"shipment_id": shipment_id}).sort("created_at", -1).to_list(1000)
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
    
    # Create geofences for the shipment
    origin_coords = {"latitude": 40.7128, "longitude": -74.0060}  # Mock coordinates
    dest_coords = {"latitude": 34.0522, "longitude": -118.2437}
    
    pickup_geofence = Geofence(
        shipment_id=bid["shipment_id"],
        name="Pickup Location",
        latitude=origin_coords["latitude"],
        longitude=origin_coords["longitude"],
        radius=500,  # 500 meter radius
        event_type="pickup"
    )
    
    delivery_geofence = Geofence(
        shipment_id=bid["shipment_id"],
        name="Delivery Location",
        latitude=dest_coords["latitude"],
        longitude=dest_coords["longitude"],
        radius=500,
        event_type="delivery"
    )
    
    await db.geofences.insert_one(pickup_geofence.dict())
    await db.geofences.insert_one(delivery_geofence.dict())
    
    # Send notifications
    await create_notification(
        user_id=bid["driver_id"],
        notification_type="bid_accepted",
        title="Bid Accepted!",
        message=f"Your bid of ${bid['bid_amount']} has been accepted",
        data={"bid_id": bid_id, "shipment_id": bid["shipment_id"]},
        priority="high",
        channels=["in_app", "sms"]
    )
    
    return {"message": "Bid accepted successfully"}

@api_router.get("/my-bids", response_model=List[Bid])
async def get_my_bids(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view their bids")
    
    bids = await db.bids.find({"driver_id": current_user.id}).sort("created_at", -1).to_list(1000)
    return [Bid(**bid) for bid in bids]

# TruxCredit Routes
@api_router.get("/trux-credit/balance")
async def get_trux_credit_balance(current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    return {"balance": user.get("trux_credit_balance", 0.0)}

@api_router.post("/trux-credit/add-funds")
async def add_trux_credit_funds(amount: float, payment_method_id: str, current_user: User = Depends(get_current_user)):
    # In real implementation, this would integrate with Stripe
    # For now, we'll just add funds directly
    
    # Create transaction record
    transaction = TruxCreditTransaction(
        user_id=current_user.id,
        amount=amount,
        transaction_type="credit",
        description=f"Added funds via credit card",
        payment_method="stripe"
    )
    await db.trux_credit_transactions.insert_one(transaction.dict())
    
    # Update user balance
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"trux_credit_balance": amount}}
    )
    
    # Send notification
    await create_notification(
        user_id=current_user.id,
        notification_type="credit_added",
        title="Funds Added",
        message=f"${amount} has been added to your TruxCredit balance",
        data={"transaction_id": transaction.id, "amount": amount}
    )
    
    return {"message": "Funds added successfully", "transaction_id": transaction.id}

@api_router.post("/payments/process")
async def process_payment(payment_create: PaymentCreate, current_user: User = Depends(get_current_user)):
    if payment_create.payment_method == "trux_credit":
        # Check balance
        user = await db.users.find_one({"id": current_user.id})
        current_balance = user.get("trux_credit_balance", 0.0)
        
        if current_balance < payment_create.amount:
            raise HTTPException(status_code=400, detail="Insufficient TruxCredit balance")
        
        # Deduct from balance
        await db.users.update_one(
            {"id": current_user.id},
            {"$inc": {"trux_credit_balance": -payment_create.amount}}
        )
        
        # Create transaction
        transaction = TruxCreditTransaction(
            user_id=current_user.id,
            amount=-payment_create.amount,
            transaction_type="debit",
            description=f"Payment for {payment_create.related_type}",
            related_id=payment_create.related_id
        )
        await db.trux_credit_transactions.insert_one(transaction.dict())
        
        return {"message": "Payment processed successfully", "transaction_id": transaction.id}
    
    else:
        # Handle Stripe payment
        # In real implementation, integrate with Stripe API
        return {"message": "Stripe payment would be processed here"}

# Review Routes
@api_router.post("/reviews", response_model=Review)
async def create_review(review_create: ReviewCreate, current_user: User = Depends(get_current_user)):
    # Verify user can review (has completed transaction)
    review_dict = review_create.dict()
    review_dict["reviewer_id"] = current_user.id
    review_dict["reviewer_email"] = current_user.email
    
    review = Review(**review_dict)
    await db.reviews.insert_one(review.dict())
    
    # Update user's average rating
    user_reviews = await db.reviews.find({"reviewed_user_id": review_create.reviewed_user_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in user_reviews) / len(user_reviews)
    
    await db.users.update_one(
        {"id": review_create.reviewed_user_id},
        {
            "$set": {"rating": round(avg_rating, 1)},
            "$inc": {"total_reviews": 1}
        }
    )
    
    # Send notification
    await create_notification(
        user_id=review_create.reviewed_user_id,
        notification_type="review_received",
        title="New Review Received",
        message=f"You received a {review_create.rating}-star review",
        data={"review_id": review.id}
    )
    
    return review

@api_router.get("/reviews/user/{user_id}", response_model=List[Review])
async def get_user_reviews(user_id: str, current_user: User = Depends(get_current_user)):
    reviews = await db.reviews.find({"reviewed_user_id": user_id}).sort("created_at", -1).to_list(100)
    return [Review(**review) for review in reviews]

# Budget Management Routes
@api_router.post("/budgets", response_model=Budget)
async def create_budget(budget_create: BudgetCreate, current_user: User = Depends(get_current_user)):
    # Calculate period end date
    period_map = {
        "weekly": timedelta(weeks=1),
        "monthly": timedelta(days=30),
        "quarterly": timedelta(days=90),
        "yearly": timedelta(days=365)
    }
    
    period_end = datetime.utcnow() + period_map[budget_create.period]
    
    budget_dict = budget_create.dict()
    budget_dict.update({
        "user_id": current_user.id,
        "remaining_amount": budget_create.total_amount,
        "period_end": period_end
    })
    
    budget = Budget(**budget_dict)
    await db.budgets.insert_one(budget.dict())
    
    return budget

@api_router.get("/budgets", response_model=List[Budget])
async def get_budgets(current_user: User = Depends(get_current_user)):
    budgets = await db.budgets.find({"user_id": current_user.id}).to_list(100)
    return [Budget(**budget) for budget in budgets]

# Analytics Routes
@api_router.post("/analytics")
async def get_analytics(analytics_query: AnalyticsQuery, current_user: User = Depends(get_current_user)):
    # Calculate date range
    end_date = datetime.utcnow()
    time_ranges = {
        "7d": end_date - timedelta(days=7),
        "30d": end_date - timedelta(days=30),
        "90d": end_date - timedelta(days=90),
        "1y": end_date - timedelta(days=365)
    }
    start_date = time_ranges.get(analytics_query.time_range, time_ranges["30d"])
    
    if analytics_query.metric == "revenue":
        # Calculate revenue from completed shipments
        pipeline = [
            {
                "$match": {
                    "shipper_id" if current_user.user_type == "shipper" else "carrier_id": current_user.id,
                    "status": "delivered",
                    "created_at": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "total": {"$sum": "$final_price"}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        results = await db.shipments.aggregate(pipeline).to_list(100)
        return {"metric": "revenue", "data": results, "total": sum(r["total"] for r in results)}
    
    elif analytics_query.metric == "shipments":
        # Count shipments by status
        pipeline = [
            {
                "$match": {
                    "shipper_id" if current_user.user_type == "shipper" else "carrier_id": current_user.id,
                    "created_at": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        results = await db.shipments.aggregate(pipeline).to_list(100)
        return {"metric": "shipments", "data": results}
    
    else:
        return {"metric": analytics_query.metric, "data": [], "message": "Metric not implemented"}

# Enhanced GPS Routes
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
    
    # Check geofences
    geofences = await db.geofences.find({"shipment_id": location.shipment_id}).to_list(100)
    triggered_geofences = []
    
    for geofence in geofences:
        # Calculate distance to geofence center
        distance = calculate_distance(
            location.latitude, location.longitude,
            geofence["latitude"], geofence["longitude"]
        )
        
        if distance <= geofence["radius"] and not geofence.get("triggered_at"):
            # Geofence triggered
            triggered_geofences.append(geofence["event_type"])
            
            # Mark geofence as triggered
            await db.geofences.update_one(
                {"id": geofence["id"]},
                {"$set": {"triggered_at": datetime.utcnow()}}
            )
            
            # Send geofence alert
            event_messages = {
                "pickup": "Driver has arrived at pickup location",
                "delivery": "Driver has arrived at delivery location"
            }
            
            await create_notification(
                user_id=shipment["shipper_id"],
                notification_type="geofence_alert",
                title=f"Location Update",
                message=event_messages.get(geofence["event_type"], "Location milestone reached"),
                data={"shipment_id": location.shipment_id, "event": geofence["event_type"]},
                priority="high",
                channels=["in_app", "sms"]
            )
    
    # Update location with geofence events
    location.geofence_events = triggered_geofences
    
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
            "timestamp": location.timestamp.isoformat(),
            "geofence_events": triggered_geofences
        }
    }, shipment["shipper_id"])
    
    return {"message": "GPS location updated", "geofence_events": triggered_geofences}

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters"""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

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

# Enhanced Messaging Routes
@api_router.post("/messages", response_model=Message)
async def send_message(message_create: MessageCreate, current_user: User = Depends(get_current_user)):
    # Find recipient based on related entity
    recipient_id = None
    
    if message_create.related_type == "shipment":
        shipment = await db.shipments.find_one({"id": message_create.related_id})
        if not shipment:
            raise HTTPException(status_code=404, detail="Shipment not found")
        
        # Determine recipient
        if current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] == current_user.id:
            recipient_id = shipment.get("carrier_id")
        elif current_user.user_type == UserRole.DRIVER and shipment.get("carrier_id") == current_user.id:
            recipient_id = shipment["shipper_id"]
        else:
            raise HTTPException(status_code=403, detail="Not authorized to send messages for this shipment")
    
    if not recipient_id:
        raise HTTPException(status_code=400, detail="No recipient found")
    
    message_dict = message_create.dict()
    message_dict.update({
        "sender_id": current_user.id,
        "sender_email": current_user.email,
        "sender_type": current_user.user_type,
        "recipient_id": recipient_id
    })
    
    message = Message(**message_dict)
    await db.messages.insert_one(message.dict())
    
    # Send real-time message
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
        data={"message_id": message.id, "related_type": message_create.related_type, "related_id": message_create.related_id}
    )
    
    return message

@api_router.get("/messages/{related_type}/{related_id}", response_model=List[Message])
async def get_messages(related_type: str, related_id: str, current_user: User = Depends(get_current_user)):
    # Verify access to the related entity
    if related_type == "shipment":
        shipment = await db.shipments.find_one({"id": related_id})
        if not shipment:
            raise HTTPException(status_code=404, detail="Shipment not found")
        
        if (current_user.user_type == UserRole.SHIPPER and shipment["shipper_id"] != current_user.id) or \
           (current_user.user_type == UserRole.DRIVER and shipment.get("carrier_id") != current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to view messages")
    
    messages = await db.messages.find({
        "related_type": related_type,
        "related_id": related_id
    }).sort("timestamp", 1).to_list(1000)
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "related_type": related_type,
            "related_id": related_id,
            "recipient_id": current_user.id
        },
        {"$set": {"read_by_recipient": True}}
    )
    
    return [Message(**message) for message in messages]

# Enhanced Notification Routes
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

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user.id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "All notifications marked as read"}

# Enhanced Dashboard Stats
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
        
        # Calculate total spend
        spend_pipeline = [
            {"$match": {"shipper_id": current_user.id, "status": "delivered"}},
            {"$group": {"_id": None, "total": {"$sum": "$final_price"}}}
        ]
        spend_result = await db.shipments.aggregate(spend_pipeline).to_list(1)
        total_spend = spend_result[0]["total"] if spend_result else 0
        
        return {
            "total_shipments": total_shipments,
            "pending_shipments": pending_shipments,
            "completed_shipments": completed_shipments,
            "active_shipments": total_shipments - completed_shipments,
            "unread_notifications": unread_notifications,
            "total_spend": total_spend,
            "trux_credit_balance": current_user.trux_credit_balance,
            "rating": current_user.rating,
            "total_reviews": current_user.total_reviews
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
        
        # Calculate total earnings
        earnings_pipeline = [
            {"$match": {"carrier_id": current_user.id, "status": "delivered"}},
            {"$group": {"_id": None, "total": {"$sum": "$final_price"}}}
        ]
        earnings_result = await db.shipments.aggregate(earnings_pipeline).to_list(1)
        total_earnings = earnings_result[0]["total"] if earnings_result else 0
        
        return {
            "total_bids": total_bids,
            "accepted_bids": accepted_bids,
            "active_shipments": active_shipments,
            "completed_shipments": completed_shipments,
            "unread_notifications": unread_notifications,
            "total_earnings": total_earnings,
            "trux_credit_balance": current_user.trux_credit_balance,
            "rating": current_user.rating,
            "total_reviews": current_user.total_reviews
        }
    
    elif current_user.user_type == UserRole.EQUIPMENT_OWNER:
        total_equipment = await db.equipment.count_documents({"owner_id": current_user.id})
        rented_equipment = await db.equipment.count_documents({
            "owner_id": current_user.id,
            "status": EquipmentStatus.RENTED
        })
        total_rentals = await db.rentals.count_documents({"owner_id": current_user.id})
        
        # Calculate rental revenue
        rental_revenue_pipeline = [
            {"$match": {"owner_id": current_user.id, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_cost"}}}
        ]
        revenue_result = await db.rentals.aggregate(rental_revenue_pipeline).to_list(1)
        rental_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        return {
            "total_equipment": total_equipment,
            "rented_equipment": rented_equipment,
            "available_equipment": total_equipment - rented_equipment,
            "total_rentals": total_rentals,
            "rental_revenue": rental_revenue,
            "trux_credit_balance": current_user.trux_credit_balance,
            "rating": current_user.rating,
            "total_reviews": current_user.total_reviews
        }
    
    elif current_user.user_type == UserRole.WAREHOUSE_OPERATOR:
        total_warehouses = await db.warehouses.count_documents({"owner_id": current_user.id})
        total_bookings = await db.storage_bookings.count_documents({"owner_id": current_user.id})
        
        # Calculate warehouse revenue
        warehouse_revenue_pipeline = [
            {"$match": {"owner_id": current_user.id, "status": "confirmed"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_cost"}}}
        ]
        revenue_result = await db.storage_bookings.aggregate(warehouse_revenue_pipeline).to_list(1)
        warehouse_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        return {
            "total_warehouses": total_warehouses,
            "total_bookings": total_bookings,
            "warehouse_revenue": warehouse_revenue,
            "trux_credit_balance": current_user.trux_credit_balance,
            "rating": current_user.rating,
            "total_reviews": current_user.total_reviews
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

# Enhanced background task for simulating GPS updates
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
                    
                    # Mock coordinates calculation (in real app, use actual GPS data)
                    origin_coords = {"lat": 40.7128, "lng": -74.0060}  # New York
                    dest_coords = {"lat": 34.0522, "lng": -118.2437}  # Los Angeles
                    
                    # Interpolate current position
                    current_lat = origin_coords["lat"] + (dest_coords["lat"] - origin_coords["lat"]) * new_progress
                    current_lng = origin_coords["lng"] + (dest_coords["lng"] - origin_coords["lng"]) * new_progress
                    
                    # Add some randomness
                    current_lat += random.uniform(-0.01, 0.01)
                    current_lng += random.uniform(-0.01, 0.01)
                    
                    mock_location = {
                        "latitude": current_lat,
                        "longitude": current_lng,
                        "speed": random.uniform(60, 80),
                        "heading": random.uniform(0, 360),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
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
                            data={"shipment_id": shipment["id"]},
                            priority="high",
                            channels=["in_app", "sms"]
                        )
                        
                        await create_notification(
                            user_id=shipment["carrier_id"],
                            notification_type="shipment_delivered",
                            title="Shipment Delivered",
                            message=f"You have successfully delivered the shipment",
                            data={"shipment_id": shipment["id"]},
                            priority="high",
                            channels=["in_app", "sms"]
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