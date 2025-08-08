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
import { Star, MapPin, Truck, Car, Eye, DollarSign, Calendar, Gauge } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VehicleMarketplace = ({ user, token }) => {
  const [vehicles, setVehicles] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    vehicle_type: '',
    brand: '',
    max_price: '',
    location: ''
  });

  // Forms
  const [vehicleForm, setVehicleForm] = useState({
    title: '',
    vehicle_type: 'truck',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    mileage: '',
    condition: 'good',
    price: '',
    location: '',
    description: '',
    specifications: {},
    images: [],
    negotiable: true,
    financing_available: false,
    warranty_included: false,
    inspection_available: false
  });

  useEffect(() => {
    fetchVehicles();
    fetchMyListings();
  }, []);

  const fetchVehicles = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await axios.get(`${API}/vehicles?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    }
  };

  const fetchMyListings = async () => {
    try {
      const response = await axios.get(`${API}/vehicles?seller=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyListings(response.data);
    } catch (error) {
      console.error('Failed to fetch my listings:', error);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formData = {
        ...vehicleForm,
        year: parseInt(vehicleForm.year),
        mileage: parseFloat(vehicleForm.mileage),
        price: parseFloat(vehicleForm.price),
        specifications: {
          engine: vehicleForm.engine || '',
          transmission: vehicleForm.transmission || '',
          fuel_type: vehicleForm.fuel_type || '',
          drive_type: vehicleForm.drive_type || '',
          payload_capacity: vehicleForm.payload_capacity || '',
          additional_features: vehicleForm.additional_features || ''
        }
      };
      
      await axios.post(`${API}/vehicles`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setVehicleForm({
        title: '',
        vehicle_type: 'truck',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        mileage: '',
        condition: 'good',
        price: '',
        location: '',
        description: '',
        specifications: {},
        images: [],
        negotiable: true,
        financing_available: false,
        warranty_included: false,
        inspection_available: false
      });
      
      fetchMyListings();
      toast.success('Vehicle listed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create vehicle listing');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatMileage = (mileage) => {
    return new Intl.NumberFormat('en-US').format(mileage) + ' miles';
  };

  const getVehicleIcon = (type) => {
    const icons = {
      truck: <Truck className="w-6 h-6" />,
      van: <Car className="w-6 h-6" />,
      trailer: <Truck className="w-6 h-6" />,
      car: <Car className="w-6 h-6" />
    };
    return icons[type] || <Truck className="w-6 h-6" />;
  };

  const getConditionColor = (condition) => {
    const colors = {
      new: 'bg-green-100 text-green-800',
      excellent: 'bg-blue-100 text-blue-800',
      good: 'bg-yellow-100 text-yellow-800',
      fair: 'bg-orange-100 text-orange-800',
      poor: 'bg-red-100 text-red-800'
    };
    return colors[condition] || 'bg-gray-100 text-gray-800';
  };

  const handleInquiry = (vehicleId) => {
    // In a real app, this would open a contact form or initiate a chat
    toast.success('Inquiry sent to seller!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicle Marketplace</h1>
          <p className="text-gray-600">Buy and sell trucks, vans, and commercial vehicles</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse">Browse Vehicles</TabsTrigger>
          <TabsTrigger value="my-listings">My Listings</TabsTrigger>
          <TabsTrigger value="sell">Sell Vehicle</TabsTrigger>
        </TabsList>

        {/* Browse Vehicles */}
        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="vehicle-type-filter">Vehicle Type</Label>
                  <Select value={filters.vehicle_type} onValueChange={(value) => setFilters({...filters, vehicle_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any type</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="trailer">Trailer</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="brand-filter">Brand</Label>
                  <Input
                    id="brand-filter"
                    value={filters.brand}
                    onChange={(e) => setFilters({...filters, brand: e.target.value})}
                    placeholder="Any brand"
                  />
                </div>
                <div>
                  <Label htmlFor="max-price-filter">Max Price</Label>
                  <Input
                    id="max-price-filter"
                    type="number"
                    value={filters.max_price}
                    onChange={(e) => setFilters({...filters, max_price: e.target.value})}
                    placeholder="No limit"
                  />
                </div>
                <div>
                  <Label htmlFor="location-filter">Location</Label>
                  <Input
                    id="location-filter"
                    value={filters.location}
                    onChange={(e) => setFilters({...filters, location: e.target.value})}
                    placeholder="Any location"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={fetchVehicles} className="bg-yellow-400 text-black hover:bg-yellow-500">
                  Apply Filters
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFilters({ vehicle_type: '', brand: '', max_price: '', location: '' });
                    fetchVehicles();
                  }}
                  className="ml-2"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Listings */}
          <div className="grid gap-6">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        {getVehicleIcon(vehicle.vehicle_type)}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{vehicle.title}</CardTitle>
                        <CardDescription className="text-base">
                          {vehicle.brand} {vehicle.model} ({vehicle.year})
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {formatCurrency(vehicle.price)}
                        {vehicle.negotiable && <span className="text-sm font-normal text-gray-500 ml-1">OBO</span>}
                      </div>
                      <Badge className={getConditionColor(vehicle.condition)}>
                        {vehicle.condition.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-gray-500">Type</Label>
                      <p className="font-medium capitalize">{vehicle.vehicle_type}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Mileage</Label>
                      <p className="font-medium">{formatMileage(vehicle.mileage)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Location</Label>
                      <p className="font-medium flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {vehicle.location}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Listed</Label>
                      <p className="font-medium">{formatDate(vehicle.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label className="text-sm text-gray-500">Description</Label>
                    <p className="mt-1">{vehicle.description}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {vehicle.financing_available && (
                      <Badge variant="secondary">Financing Available</Badge>
                    )}
                    {vehicle.warranty_included && (
                      <Badge variant="secondary">Warranty Included</Badge>
                    )}
                    {vehicle.inspection_available && (
                      <Badge variant="secondary">Inspection Available</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Eye className="w-4 h-4" />
                        <span>{vehicle.views} views</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>{vehicle.inquiries} inquiries</span>
                      </div>
                    </div>
                    {vehicle.featured && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        FEATURED
                      </Badge>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">View Details</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{vehicle.title}</DialogTitle>
                        <DialogDescription>
                          {vehicle.brand} {vehicle.model} ({vehicle.year})
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-gray-500">Price</Label>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(vehicle.price)}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-500">Condition</Label>
                            <Badge className={getConditionColor(vehicle.condition)}>
                              {vehicle.condition.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm text-gray-500">Mileage</Label>
                            <p className="font-medium">{formatMileage(vehicle.mileage)}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-500">Engine</Label>
                            <p className="font-medium">{vehicle.specifications?.engine || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-500">Transmission</Label>
                            <p className="font-medium">{vehicle.specifications?.transmission || 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm text-gray-500">Description</Label>
                          <p className="mt-1">{vehicle.description}</p>
                        </div>
                        
                        <div>
                          <Label className="text-sm text-gray-500">Location</Label>
                          <p className="font-medium flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {vehicle.location}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    onClick={() => handleInquiry(vehicle.id)}
                    className="bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    Contact Seller
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* My Listings */}
        <TabsContent value="my-listings" className="space-y-6">
          <div className="grid gap-6">
            {myListings.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Truck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">You haven't listed any vehicles yet</p>
                  <Button 
                    onClick={() => setActiveTab('sell')}
                    className="mt-4 bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    List Your First Vehicle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myListings.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{vehicle.title}</CardTitle>
                        <CardDescription>
                          {vehicle.brand} {vehicle.model} ({vehicle.year})
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(vehicle.price)}
                        </div>
                        <Badge className={vehicle.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {vehicle.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-500">Views</Label>
                        <p className="font-medium">{vehicle.views}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Inquiries</Label>
                        <p className="font-medium">{vehicle.inquiries}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Listed</Label>
                        <p className="font-medium">{formatDate(vehicle.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="space-x-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="outline" size="sm">View</Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Sell Vehicle */}
        <TabsContent value="sell" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>List Your Vehicle</CardTitle>
              <CardDescription>Create a listing for your vehicle</CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleCreateListing} className="space-y-6">
                <div>
                  <Label htmlFor="listing-title">Listing Title</Label>
                  <Input
                    id="listing-title"
                    value={vehicleForm.title}
                    onChange={(e) => setVehicleForm({...vehicleForm, title: e.target.value})}
                    placeholder="e.g., 2020 Ford F-150 XLT - Excellent Condition"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vehicle-type">Vehicle Type</Label>
                    <Select value={vehicleForm.vehicle_type} onValueChange={(value) => setVehicleForm({...vehicleForm, vehicle_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="trailer">Trailer</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="condition">Condition</Label>
                    <Select value={vehicleForm.condition} onValueChange={(value) => setVehicleForm({...vehicleForm, condition: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={vehicleForm.brand}
                      onChange={(e) => setVehicleForm({...vehicleForm, brand: e.target.value})}
                      placeholder="e.g., Ford"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})}
                      placeholder="e.g., F-150"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      min="1990"
                      max={new Date().getFullYear()}
                      value={vehicleForm.year}
                      onChange={(e) => setVehicleForm({...vehicleForm, year: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="mileage">Mileage</Label>
                    <Input
                      id="mileage"
                      type="number"
                      min="0"
                      value={vehicleForm.mileage}
                      onChange={(e) => setVehicleForm({...vehicleForm, mileage: e.target.value})}
                      placeholder="Miles"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      value={vehicleForm.price}
                      onChange={(e) => setVehicleForm({...vehicleForm, price: e.target.value})}
                      placeholder="Asking price"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={vehicleForm.location}
                      onChange={(e) => setVehicleForm({...vehicleForm, location: e.target.value})}
                      placeholder="City, State"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={vehicleForm.description}
                    onChange={(e) => setVehicleForm({...vehicleForm, description: e.target.value})}
                    placeholder="Detailed description of your vehicle's condition, features, and history"
                    rows={4}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="engine">Engine</Label>
                    <Input
                      id="engine"
                      value={vehicleForm.engine}
                      onChange={(e) => setVehicleForm({...vehicleForm, engine: e.target.value})}
                      placeholder="e.g., 3.5L V6"
                    />
                  </div>
                  <div>
                    <Label htmlFor="transmission">Transmission</Label>
                    <Input
                      id="transmission"
                      value={vehicleForm.transmission}
                      onChange={(e) => setVehicleForm({...vehicleForm, transmission: e.target.value})}
                      placeholder="e.g., Automatic"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="negotiable"
                      checked={vehicleForm.negotiable}
                      onChange={(e) => setVehicleForm({...vehicleForm, negotiable: e.target.checked})}
                    />
                    <Label htmlFor="negotiable">Price is negotiable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="financing"
                      checked={vehicleForm.financing_available}
                      onChange={(e) => setVehicleForm({...vehicleForm, financing_available: e.target.checked})}
                    />
                    <Label htmlFor="financing">Financing available</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="warranty"
                      checked={vehicleForm.warranty_included}
                      onChange={(e) => setVehicleForm({...vehicleForm, warranty_included: e.target.checked})}
                    />
                    <Label htmlFor="warranty">Warranty included</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="inspection"
                      checked={vehicleForm.inspection_available}
                      onChange={(e) => setVehicleForm({...vehicleForm, inspection_available: e.target.checked})}
                    />
                    <Label htmlFor="inspection">Inspection available</Label>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
                >
                  {isLoading ? 'Creating Listing...' : 'List Vehicle'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VehicleMarketplace;