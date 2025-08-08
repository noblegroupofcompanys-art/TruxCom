import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Progress } from './components/ui/progress';
import { toast } from 'sonner';
import { Truck, Package, MapPin, Calendar, DollarSign, User, Bell, LogOut, Plus, Eye, CheckCircle, MessageSquare, Navigation, Clock } from 'lucide-react';

// Import new components
import MapView from './components/MapView';
import NotificationCenter from './components/NotificationCenter';
import MessagingCenter from './components/MessagingCenter';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [bids, setBids] = useState([]);
  const [stats, setStats] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Real-time features
  const [wsConnection, setWsConnection] = useState(null);
  const [selectedShipmentForChat, setSelectedShipmentForChat] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedShipmentForMap, setSelectedShipmentForMap] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const wsRef = useRef(null);

  // Auth Forms
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    phone_number: '',
    user_type: 'shipper',
    company_name: '',
    license_number: ''
  });

  // Shipment Form
  const [shipmentForm, setShipmentForm] = useState({
    origin_address: '',
    destination_address: '',
    cargo_description: '',
    cargo_weight: '',
    cargo_dimensions: '',
    vehicle_type_required: 'truck',
    pickup_date: '',
    delivery_deadline: '',
    offered_price: '',
    special_requirements: ''
  });

  // Bid Form
  const [bidForm, setBidForm] = useState({
    shipment_id: '',
    bid_amount: '',
    message: '',
    estimated_pickup: '',
    estimated_delivery: ''
  });

  // WebSocket connection
  useEffect(() => {
    if (token && user) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, user]);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/${user.id}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnection(wsRef.current);
        
        // Send ping to keep connection alive
        const pingInterval = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        wsRef.current.pingInterval = pingInterval;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnection(null);
        
        if (wsRef.current?.pingInterval) {
          clearInterval(wsRef.current.pingInterval);
        }
        
        // Reconnect after 3 seconds if user is still logged in
        if (token && user) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'notification':
        setNotifications(prev => [data.data, ...prev]);
        toast(data.data.title, {
          description: data.data.message,
          action: {
            label: "View",
            onClick: () => console.log("Notification clicked"),
          },
        });
        break;
        
      case 'location_update':
        // Update shipment location in real-time
        setShipments(prev => 
          prev.map(shipment => 
            shipment.id === data.shipment_id 
              ? { ...shipment, current_location: data.location, route_progress: data.progress }
              : shipment
          )
        );
        break;
        
      case 'new_message':
        // Handle new messages if chat is open for this shipment
        if (selectedShipmentForChat?.id === data.data.shipment_id) {
          fetchDashboardData(); // Refresh to show new message
        }
        break;
        
      case 'pong':
        // Handle ping response
        break;
        
      default:
        console.log('Unknown WebSocket message:', data);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser();
      fetchDashboardData();
      fetchNotifications();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [shipmentsResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/shipments`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setShipments(shipmentsResponse.data);
      setStats(statsResponse.data);

      // Fetch bids if driver
      if (user && user.user_type === 'driver') {
        const bidsResponse = await axios.get(`${API}/my-bids`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBids(bidsResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const response = await axios.post(`${API}${endpoint}`, authData);
      
      setToken(response.data.access_token);
      localStorage.setItem('token', response.data.access_token);
      
      // Reset form
      setAuthData({
        email: '',
        password: '',
        phone_number: '',
        user_type: 'shipper',
        company_name: '',
        license_number: ''
      });
    } catch (error) {
      alert(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setShipments([]);
    setBids([]);
    setStats({});
    setNotifications([]);
    
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formData = {
        ...shipmentForm,
        cargo_weight: parseFloat(shipmentForm.cargo_weight),
        offered_price: parseFloat(shipmentForm.offered_price),
        pickup_date: new Date(shipmentForm.pickup_date).toISOString(),
        delivery_deadline: new Date(shipmentForm.delivery_deadline).toISOString()
      };
      
      await axios.post(`${API}/shipments`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form and refresh data
      setShipmentForm({
        origin_address: '',
        destination_address: '',
        cargo_description: '',
        cargo_weight: '',
        cargo_dimensions: '',
        vehicle_type_required: 'truck',
        pickup_date: '',
        delivery_deadline: '',
        offered_price: '',
        special_requirements: ''
      });
      
      fetchDashboardData();
      toast.success('Shipment created successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBid = async (shipmentId) => {
    if (!bidForm.bid_amount || !bidForm.estimated_pickup || !bidForm.estimated_delivery) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formData = {
        shipment_id: shipmentId,
        bid_amount: parseFloat(bidForm.bid_amount),
        message: bidForm.message,
        estimated_pickup: new Date(bidForm.estimated_pickup).toISOString(),
        estimated_delivery: new Date(bidForm.estimated_delivery).toISOString()
      };
      
      await axios.post(`${API}/bids`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form and refresh data
      setBidForm({
        shipment_id: '',
        bid_amount: '',
        message: '',
        estimated_pickup: '',
        estimated_delivery: ''
      });
      
      fetchDashboardData();
      toast.success('Bid submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit bid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptBid = async (bidId) => {
    if (!window.confirm('Are you sure you want to accept this bid?')) return;
    
    setIsLoading(true);
    
    try {
      await axios.post(`${API}/bids/${bidId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchDashboardData();
      toast.success('Bid accepted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept bid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    try {
      await Promise.all(
        unreadNotifications.map(n =>
          axios.post(`${API}/notifications/${n.id}/mark-read`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const openChat = (shipment) => {
    setSelectedShipmentForChat(shipment);
    setIsChatOpen(true);
  };

  const openMap = (shipment) => {
    setSelectedShipmentForMap(shipment);
    setIsMapOpen(true);
  };

  // Simulate starting transit for demo
  const startTransit = async (shipmentId) => {
    try {
      // This would normally be done by the driver's mobile app
      // For demo, we'll just update the status
      await axios.patch(`${API}/shipments/${shipmentId}`, {
        status: 'in_transit'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchDashboardData();
      toast.success('Transit started! GPS tracking is now active.');
    } catch (error) {
      console.error('Failed to start transit:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      bidding: 'bg-blue-100 text-blue-800',
      booked: 'bg-green-100 text-green-800',
      in_transit: 'bg-purple-100 text-purple-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-black" />
            </div>
            <CardTitle className="text-2xl font-bold">TruxCom</CardTitle>
            <CardDescription>Your Real-Time Logistics Marketplace</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={authMode} onValueChange={setAuthMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={authData.email}
                      onChange={(e) => setAuthData({...authData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={authData.password}
                      onChange={(e) => setAuthData({...authData, password: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-yellow-400 text-black hover:bg-yellow-500" disabled={isLoading}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={authData.email}
                      onChange={(e) => setAuthData({...authData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={authData.password}
                      onChange={(e) => setAuthData({...authData, password: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={authData.phone_number}
                      onChange={(e) => setAuthData({...authData, phone_number: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-type">Account Type</Label>
                    <Select value={authData.user_type} onValueChange={(value) => setAuthData({...authData, user_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shipper">Shipper (Need to ship cargo)</SelectItem>
                        <SelectItem value="driver">Driver/Carrier (Transport cargo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {authData.user_type === 'shipper' && (
                    <div>
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={authData.company_name}
                        onChange={(e) => setAuthData({...authData, company_name: e.target.value})}
                        required
                      />
                    </div>
                  )}
                  {authData.user_type === 'driver' && (
                    <div>
                      <Label htmlFor="license">License Number</Label>
                      <Input
                        id="license"
                        value={authData.license_number}
                        onChange={(e) => setAuthData({...authData, license_number: e.target.value})}
                        required
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-yellow-400 text-black hover:bg-yellow-500" disabled={isLoading}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">TruxCom</h1>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${wsConnection ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{wsConnection ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationCenter 
                notifications={notifications}
                onMarkAsRead={handleMarkNotificationRead}
                onMarkAllAsRead={handleMarkAllNotificationsRead}
              />
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">{user.email}</span>
                <Badge variant="outline" className="capitalize">
                  {user.user_type}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="shipments">
              {user.user_type === 'shipper' ? 'My Shipments' : 'Available Loads'}
            </TabsTrigger>
            <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
            <TabsTrigger value="bids">
              {user.user_type === 'shipper' ? 'Manage Bids' : 'My Bids'}
            </TabsTrigger>
            <TabsTrigger value="create">
              {user.user_type === 'shipper' ? 'Create Shipment' : 'Find Loads'}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {user.user_type === 'shipper' ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.total_shipments || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.pending_shipments || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active</CardTitle>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.active_shipments || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.completed_shipments || 0}</div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Bids</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.total_bids || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Accepted Bids</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.accepted_bids || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.active_shipments || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.completed_shipments || 0}</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shipments.slice(0, 5).map((shipment) => (
                    <div key={shipment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">{shipment.origin_address} → {shipment.destination_address}</p>
                          <p className="text-sm text-gray-500">{shipment.cargo_description}</p>
                        </div>
                      </div>
                      <Badge className={getStatusBadgeColor(shipment.status)}>
                        {shipment.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shipments */}
          <TabsContent value="shipments" className="space-y-6">
            <div className="grid gap-6">
              {shipments.map((shipment) => (
                <Card key={shipment.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <MapPin className="w-5 h-5 text-gray-600" />
                          <span>{shipment.origin_address} → {shipment.destination_address}</span>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {shipment.cargo_description} • {shipment.cargo_weight}kg • {shipment.cargo_dimensions}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusBadgeColor(shipment.status)}>
                        {shipment.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm text-gray-500">Vehicle Type</Label>
                        <p className="font-medium capitalize">{shipment.vehicle_type_required}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Offered Price</Label>
                        <p className="font-medium">{formatCurrency(shipment.offered_price)}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Pickup Date</Label>
                        <p className="font-medium">{formatDate(shipment.pickup_date)}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Delivery Deadline</Label>
                        <p className="font-medium">{formatDate(shipment.delivery_deadline)}</p>
                      </div>
                    </div>
                    
                    {shipment.special_requirements && (
                      <div className="mt-4">
                        <Label className="text-sm text-gray-500">Special Requirements</Label>
                        <p className="mt-1">{shipment.special_requirements}</p>
                      </div>
                    )}
                  </CardContent>
                  
                  {user.user_type === 'driver' && shipment.status === 'bidding' && (
                    <CardFooter>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="bg-yellow-400 text-black hover:bg-yellow-500">
                            Place Bid
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Place Your Bid</DialogTitle>
                            <DialogDescription>
                              Submit your bid for this shipment
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="bid-amount">Bid Amount ($)</Label>
                              <Input
                                id="bid-amount"
                                type="number"
                                value={bidForm.bid_amount}
                                onChange={(e) => setBidForm({...bidForm, bid_amount: e.target.value})}
                                placeholder="Enter your bid amount"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bid-pickup">Estimated Pickup Date</Label>
                              <Input
                                id="bid-pickup"
                                type="datetime-local"
                                value={bidForm.estimated_pickup}
                                onChange={(e) => setBidForm({...bidForm, estimated_pickup: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bid-delivery">Estimated Delivery Date</Label>
                              <Input
                                id="bid-delivery"
                                type="datetime-local"
                                value={bidForm.estimated_delivery}
                                onChange={(e) => setBidForm({...bidForm, estimated_delivery: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bid-message">Message (Optional)</Label>
                              <Textarea
                                id="bid-message"
                                value={bidForm.message}
                                onChange={(e) => setBidForm({...bidForm, message: e.target.value})}
                                placeholder="Additional information about your bid"
                                rows={3}
                              />
                            </div>
                          </div>
                          
                          <DialogFooter>
                            <Button
                              onClick={() => handleCreateBid(shipment.id)}
                              disabled={isLoading}
                              className="bg-yellow-400 text-black hover:bg-yellow-500"
                            >
                              {isLoading ? 'Submitting...' : 'Submit Bid'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Create Shipment (Shipper) / Find Loads (Driver) */}
          <TabsContent value="create" className="space-y-6">
            {user.user_type === 'shipper' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Shipment</CardTitle>
                  <CardDescription>Post a new shipment to get bids from carriers</CardDescription>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleCreateShipment} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="origin">Origin Address</Label>
                        <Input
                          id="origin"
                          value={shipmentForm.origin_address}
                          onChange={(e) => setShipmentForm({...shipmentForm, origin_address: e.target.value})}
                          placeholder="Enter pickup address"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="destination">Destination Address</Label>
                        <Input
                          id="destination"
                          value={shipmentForm.destination_address}
                          onChange={(e) => setShipmentForm({...shipmentForm, destination_address: e.target.value})}
                          placeholder="Enter delivery address"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="cargo-desc">Cargo Description</Label>
                      <Textarea
                        id="cargo-desc"
                        value={shipmentForm.cargo_description}
                        onChange={(e) => setShipmentForm({...shipmentForm, cargo_description: e.target.value})}
                        placeholder="Describe what needs to be shipped"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="weight">Cargo Weight (kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          value={shipmentForm.cargo_weight}
                          onChange={(e) => setShipmentForm({...shipmentForm, cargo_weight: e.target.value})}
                          placeholder="Weight in kg"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="dimensions">Dimensions</Label>
                        <Input
                          id="dimensions"
                          value={shipmentForm.cargo_dimensions}
                          onChange={(e) => setShipmentForm({...shipmentForm, cargo_dimensions: e.target.value})}
                          placeholder="L x W x H"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-type">Vehicle Type Required</Label>
                        <Select value={shipmentForm.vehicle_type_required} onValueChange={(value) => setShipmentForm({...shipmentForm, vehicle_type_required: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="truck">Truck</SelectItem>
                            <SelectItem value="van">Van</SelectItem>
                            <SelectItem value="trailer">Trailer</SelectItem>
                            <SelectItem value="flatbed">Flatbed</SelectItem>
                            <SelectItem value="refrigerated">Refrigerated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="pickup-date">Pickup Date</Label>
                        <Input
                          id="pickup-date"
                          type="datetime-local"
                          value={shipmentForm.pickup_date}
                          onChange={(e) => setShipmentForm({...shipmentForm, pickup_date: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-deadline">Delivery Deadline</Label>
                        <Input
                          id="delivery-deadline"
                          type="datetime-local"
                          value={shipmentForm.delivery_deadline}
                          onChange={(e) => setShipmentForm({...shipmentForm, delivery_deadline: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="offered-price">Offered Price ($)</Label>
                        <Input
                          id="offered-price"
                          type="number"
                          value={shipmentForm.offered_price}
                          onChange={(e) => setShipmentForm({...shipmentForm, offered_price: e.target.value})}
                          placeholder="Your budget"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="special-req">Special Requirements (Optional)</Label>
                      <Textarea
                        id="special-req"
                        value={shipmentForm.special_requirements}
                        onChange={(e) => setShipmentForm({...shipmentForm, special_requirements: e.target.value})}
                        placeholder="Any special handling requirements"
                        rows={3}
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
                    >
                      {isLoading ? 'Creating Shipment...' : 'Create Shipment'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Find Loads</CardTitle>
                    <CardDescription>Browse available shipments and place your bids</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-gray-500">Switch to the "Available Loads" tab to see all available shipments you can bid on.</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Bids Management */}
          <TabsContent value="bids" className="space-y-6">
            {user.user_type === 'driver' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>My Bids</CardTitle>
                    <CardDescription>Track all your submitted bids</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {bids.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No bids submitted yet</p>
                      ) : (
                        bids.map((bid) => (
                          <div key={bid.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">Bid Amount: {formatCurrency(bid.bid_amount)}</p>
                                <p className="text-sm text-gray-500">
                                  Pickup: {formatDate(bid.estimated_pickup)} | 
                                  Delivery: {formatDate(bid.estimated_delivery)}
                                </p>
                              </div>
                              <Badge className={
                                bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                bid.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {bid.status.toUpperCase()}
                              </Badge>
                            </div>
                            {bid.message && (
                              <p className="text-sm text-gray-600 mt-2">Message: {bid.message}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              Submitted: {formatDate(bid.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;