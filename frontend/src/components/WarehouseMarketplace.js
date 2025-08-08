import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Star, Calendar, MapPin, Warehouse, Thermometer, Shield, Clock, Package } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WarehouseMarketplace = ({ user, token }) => {
  const [warehouses, setWarehouses] = useState([]);
  const [myWarehouses, setMyWarehouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [isLoading, setIsLoading] = useState(false);

  // Forms
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    address: '',
    storage_types: [],
    capacity_sqm: '',
    available_sqm: '',
    features: [],
    pricing_per_sqm_monthly: '',
    minimum_storage_period: 'month',
    description: '',
    images: [],
    operating_hours: '',
    contact_person: '',
    contact_phone: '',
    services_offered: []
  });

  const [bookingForm, setBookingForm] = useState({
    warehouse_id: '',
    storage_type: '',
    required_sqm: '',
    start_date: '',
    duration_months: 1,
    cargo_description: '',
    special_requirements: ''
  });

  useEffect(() => {
    fetchWarehouses();
    if (user.user_type === 'warehouse_operator') {
      fetchMyWarehouses();
      fetchMyBookings();
    }
  }, [user]);

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(`${API}/warehouses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(response.data);
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  const fetchMyWarehouses = async () => {
    try {
      const response = await axios.get(`${API}/warehouses?owner=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyWarehouses(response.data);
    } catch (error) {
      console.error('Failed to fetch my warehouses:', error);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await axios.get(`${API}/storage-bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formData = {
        ...warehouseForm,
        capacity_sqm: parseFloat(warehouseForm.capacity_sqm),
        available_sqm: parseFloat(warehouseForm.available_sqm),
        pricing_per_sqm_monthly: parseFloat(warehouseForm.pricing_per_sqm_monthly)
      };
      
      await axios.post(`${API}/warehouses`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setWarehouseForm({
        name: '',
        address: '',
        storage_types: [],
        capacity_sqm: '',
        available_sqm: '',
        features: [],
        pricing_per_sqm_monthly: '',
        minimum_storage_period: 'month',
        description: '',
        images: [],
        operating_hours: '',
        contact_person: '',
        contact_phone: '',
        services_offered: []
      });
      
      fetchMyWarehouses();
      toast.success('Warehouse listed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create warehouse listing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookWarehouse = async (warehouseId) => {
    if (!bookingForm.start_date || !bookingForm.required_sqm || !bookingForm.duration_months) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formData = {
        ...bookingForm,
        warehouse_id: warehouseId,
        required_sqm: parseFloat(bookingForm.required_sqm),
        duration_months: parseInt(bookingForm.duration_months),
        start_date: new Date(bookingForm.start_date).toISOString()
      };
      
      await axios.post(`${API}/warehouses/${warehouseId}/book`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setBookingForm({
        warehouse_id: '',
        storage_type: '',
        required_sqm: '',
        start_date: '',
        duration_months: 1,
        cargo_description: '',
        special_requirements: ''
      });
      
      fetchWarehouses();
      toast.success('Warehouse storage booked successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book warehouse storage');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStorageTypeIcon = (type) => {
    const icons = {
      ambient: <Warehouse className="w-5 h-5 text-gray-600" />,
      chilled: <Thermometer className="w-5 h-5 text-blue-600" />,
      frozen: <Thermometer className="w-5 h-5 text-blue-800" />,
      hazmat: <Shield className="w-5 h-5 text-red-600" />,
      bulk: <Package className="w-5 h-5 text-brown-600" />
    };
    return icons[type] || <Warehouse className="w-5 h-5 text-gray-600" />;
  };

  const renderRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const handleFeatureChange = (feature, checked) => {
    if (checked) {
      setWarehouseForm(prev => ({
        ...prev,
        features: [...prev.features, feature]
      }));
    } else {
      setWarehouseForm(prev => ({
        ...prev,
        features: prev.features.filter(f => f !== feature)
      }));
    }
  };

  const handleStorageTypeChange = (storageType, checked) => {
    if (checked) {
      setWarehouseForm(prev => ({
        ...prev,
        storage_types: [...prev.storage_types, storageType]
      }));
    } else {
      setWarehouseForm(prev => ({
        ...prev,
        storage_types: prev.storage_types.filter(t => t !== storageType)
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Warehouse Marketplace</h1>
          <p className="text-gray-600">Find or list warehouse storage space</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Warehouses</TabsTrigger>
          {user.user_type === 'warehouse_operator' && <TabsTrigger value="my-warehouses">My Warehouses</TabsTrigger>}
          {user.user_type === 'warehouse_operator' && <TabsTrigger value="bookings">Bookings</TabsTrigger>}
          {user.user_type === 'warehouse_operator' && <TabsTrigger value="add">Add Warehouse</TabsTrigger>}
        </TabsList>

        {/* Browse Warehouses */}
        <TabsContent value="browse" className="space-y-6">
          <div className="grid gap-6">
            {warehouses.map((warehouse) => (
              <Card key={warehouse.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Warehouse className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{warehouse.name}</CardTitle>
                        <CardDescription className="text-base flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{warehouse.address}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-2">
                        {warehouse.status.toUpperCase()}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        {renderRatingStars(warehouse.rating)}
                        <span className="text-sm text-gray-500">({warehouse.total_reviews})</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-gray-500">Total Capacity</Label>
                      <p className="font-medium">{warehouse.capacity_sqm.toLocaleString()} sq m</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Available Space</Label>
                      <p className="font-medium text-green-600">{warehouse.available_sqm.toLocaleString()} sq m</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Monthly Rate</Label>
                      <p className="font-medium">{formatCurrency(warehouse.pricing_per_sqm_monthly)}/sq m</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Operating Hours</Label>
                      <p className="font-medium">{warehouse.operating_hours}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label className="text-sm text-gray-500 mb-2 block">Storage Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {warehouse.storage_types.map((type) => (
                        <Badge key={type} variant="secondary" className="flex items-center space-x-1">
                          {getStorageTypeIcon(type)}
                          <span className="capitalize">{type}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label className="text-sm text-gray-500">Description</Label>
                    <p className="mt-1">{warehouse.description}</p>
                  </div>
                  
                  {warehouse.features.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm text-gray-500 mb-2 block">Features</Label>
                      <div className="flex flex-wrap gap-2">
                        {warehouse.features.map((feature) => (
                          <Badge key={feature} variant="outline">
                            {feature.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {warehouse.services_offered.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm text-gray-500 mb-2 block">Services Offered</Label>
                      <div className="flex flex-wrap gap-2">
                        {warehouse.services_offered.map((service) => (
                          <Badge key={service} variant="secondary">
                            {service.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Contact: </span>
                      <span className="font-medium">{warehouse.contact_person}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Phone: </span>
                      <span className="font-medium">{warehouse.contact_phone}</span>
                    </div>
                  </div>
                </CardContent>
                
                {warehouse.available_sqm > 0 && user.user_type !== 'warehouse_operator' && (
                  <CardFooter>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-yellow-400 text-black hover:bg-yellow-500">
                          <Calendar className="w-4 h-4 mr-2" />
                          Book Storage
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Book Storage at {warehouse.name}</DialogTitle>
                          <DialogDescription>
                            Configure your storage requirements
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="storage-type">Storage Type</Label>
                            <Select value={bookingForm.storage_type} onValueChange={(value) => setBookingForm({...bookingForm, storage_type: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouse.storage_types.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    <div className="flex items-center space-x-2">
                                      {getStorageTypeIcon(type)}
                                      <span className="capitalize">{type}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="required-space">Required Space (sq m)</Label>
                            <Input
                              id="required-space"
                              type="number"
                              min="1"
                              max={warehouse.available_sqm}
                              value={bookingForm.required_sqm}
                              onChange={(e) => setBookingForm({...bookingForm, required_sqm: e.target.value})}
                              placeholder="Enter space requirement"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Available: {warehouse.available_sqm.toLocaleString()} sq m
                            </p>
                          </div>
                          
                          <div>
                            <Label htmlFor="start-date">Start Date</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={bookingForm.start_date}
                              onChange={(e) => setBookingForm({...bookingForm, start_date: e.target.value})}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="duration">Duration (months)</Label>
                            <Input
                              id="duration"
                              type="number"
                              min="1"
                              value={bookingForm.duration_months}
                              onChange={(e) => setBookingForm({...bookingForm, duration_months: e.target.value})}
                              placeholder="Enter duration in months"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="cargo-description">Cargo Description</Label>
                            <Textarea
                              id="cargo-description"
                              value={bookingForm.cargo_description}
                              onChange={(e) => setBookingForm({...bookingForm, cargo_description: e.target.value})}
                              placeholder="Describe what you'll be storing"
                              rows={3}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="special-requirements">Special Requirements</Label>
                            <Textarea
                              id="special-requirements"
                              value={bookingForm.special_requirements}
                              onChange={(e) => setBookingForm({...bookingForm, special_requirements: e.target.value})}
                              placeholder="Any special storage requirements"
                              rows={2}
                            />
                          </div>
                          
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Monthly cost:</span>
                                <span>
                                  {formatCurrency(
                                    warehouse.pricing_per_sqm_monthly * (parseFloat(bookingForm.required_sqm) || 0)
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center font-bold">
                                <span>Total cost:</span>
                                <span className="text-lg text-green-600">
                                  {formatCurrency(
                                    warehouse.pricing_per_sqm_monthly * 
                                    (parseFloat(bookingForm.required_sqm) || 0) * 
                                    (parseInt(bookingForm.duration_months) || 1)
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button
                            onClick={() => handleBookWarehouse(warehouse.id)}
                            disabled={isLoading}
                            className="bg-yellow-400 text-black hover:bg-yellow-500"
                          >
                            {isLoading ? 'Booking...' : 'Book Storage'}
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

        {/* Add Warehouse (Warehouse Operators) */}
        {user.user_type === 'warehouse_operator' && (
          <TabsContent value="add" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>List New Warehouse</CardTitle>
                <CardDescription>Add your warehouse to the marketplace</CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleCreateWarehouse} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="warehouse-name">Warehouse Name</Label>
                      <Input
                        id="warehouse-name"
                        value={warehouseForm.name}
                        onChange={(e) => setWarehouseForm({...warehouseForm, name: e.target.value})}
                        placeholder="e.g., Central Distribution Center"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={warehouseForm.address}
                        onChange={(e) => setWarehouseForm({...warehouseForm, address: e.target.value})}
                        placeholder="Full warehouse address"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Storage Types</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {['ambient', 'chilled', 'frozen', 'hazmat', 'bulk'].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={type}
                            checked={warehouseForm.storage_types.includes(type)}
                            onChange={(e) => handleStorageTypeChange(type, e.target.checked)}
                          />
                          <Label htmlFor={type} className="capitalize text-sm">{type}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="capacity">Total Capacity (sq m)</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="1"
                        value={warehouseForm.capacity_sqm}
                        onChange={(e) => setWarehouseForm({...warehouseForm, capacity_sqm: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="available">Available Space (sq m)</Label>
                      <Input
                        id="available"
                        type="number"
                        min="0"
                        value={warehouseForm.available_sqm}
                        onChange={(e) => setWarehouseForm({...warehouseForm, available_sqm: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="pricing">Monthly Rate ($/sq m)</Label>
                      <Input
                        id="pricing"
                        type="number"
                        step="0.01"
                        min="0"
                        value={warehouseForm.pricing_per_sqm_monthly}
                        onChange={(e) => setWarehouseForm({...warehouseForm, pricing_per_sqm_monthly: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={warehouseForm.description}
                      onChange={(e) => setWarehouseForm({...warehouseForm, description: e.target.value})}
                      placeholder="Detailed description of your warehouse facility"
                      rows={4}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Features</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['dock_doors', 'forklifts', 'security', 'climate_control', 'loading_bays', 'office_space', 'parking', '24_7_access'].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={feature}
                            checked={warehouseForm.features.includes(feature)}
                            onChange={(e) => handleFeatureChange(feature, e.target.checked)}
                          />
                          <Label htmlFor={feature} className="text-sm">{feature.replace('_', ' ')}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="operating-hours">Operating Hours</Label>
                      <Input
                        id="operating-hours"
                        value={warehouseForm.operating_hours}
                        onChange={(e) => setWarehouseForm({...warehouseForm, operating_hours: e.target.value})}
                        placeholder="e.g., 6 AM - 6 PM"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-person">Contact Person</Label>
                      <Input
                        id="contact-person"
                        value={warehouseForm.contact_person}
                        onChange={(e) => setWarehouseForm({...warehouseForm, contact_person: e.target.value})}
                        placeholder="Contact person name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-phone">Contact Phone</Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        value={warehouseForm.contact_phone}
                        onChange={(e) => setWarehouseForm({...warehouseForm, contact_phone: e.target.value})}
                        placeholder="Phone number"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    {isLoading ? 'Listing Warehouse...' : 'List Warehouse'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default WarehouseMarketplace;