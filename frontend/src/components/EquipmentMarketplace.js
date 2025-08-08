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
import { Star, Calendar, MapPin, Truck, Settings, DollarSign, Clock, Package } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EquipmentMarketplace = ({ user, token }) => {
  const [equipment, setEquipment] = useState([]);
  const [myEquipment, setMyEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [isLoading, setIsLoading] = useState(false);

  // Forms
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    equipment_type: 'truck',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    specifications: {},
    location: '',
    rental_rate_hourly: '',
    rental_rate_daily: '',
    rental_rate_weekly: '',
    rental_rate_monthly: '',
    minimum_rental_period: 'day',
    description: '',
    images: [],
    insurance_included: false,
    delivery_available: false,
    delivery_radius: '',
    delivery_fee: ''
  });

  const [rentalForm, setRentalForm] = useState({
    equipment_id: '',
    rental_period: 'daily',
    rental_duration: 1,
    start_date: '',
    delivery_required: false,
    delivery_address: '',
    special_instructions: ''
  });

  useEffect(() => {
    fetchEquipment();
    if (user.user_type === 'equipment_owner') {
      fetchMyEquipment();
      fetchMyRentals();
    }
  }, [user]);

  const fetchEquipment = async () => {
    try {
      const response = await axios.get(`${API}/equipment`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquipment(response.data);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  };

  const fetchMyEquipment = async () => {
    try {
      const response = await axios.get(`${API}/equipment?owner=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyEquipment(response.data);
    } catch (error) {
      console.error('Failed to fetch my equipment:', error);
    }
  };

  const fetchMyRentals = async () => {
    try {
      const response = await axios.get(`${API}/rentals/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRentals(response.data);
    } catch (error) {
      console.error('Failed to fetch rentals:', error);
    }
  };

  const handleCreateEquipment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formData = {
        ...equipmentForm,
        year: parseInt(equipmentForm.year),
        rental_rate_hourly: parseFloat(equipmentForm.rental_rate_hourly),
        rental_rate_daily: parseFloat(equipmentForm.rental_rate_daily),
        rental_rate_weekly: parseFloat(equipmentForm.rental_rate_weekly),
        rental_rate_monthly: parseFloat(equipmentForm.rental_rate_monthly),
        delivery_radius: equipmentForm.delivery_radius ? parseFloat(equipmentForm.delivery_radius) : null,
        delivery_fee: equipmentForm.delivery_fee ? parseFloat(equipmentForm.delivery_fee) : null,
        specifications: {
          capacity: equipmentForm.capacity || '',
          fuel_type: equipmentForm.fuel_type || '',
          transmission: equipmentForm.transmission || '',
          additional_info: equipmentForm.additional_info || ''
        }
      };
      
      await axios.post(`${API}/equipment`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setEquipmentForm({
        name: '',
        equipment_type: 'truck',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        specifications: {},
        location: '',
        rental_rate_hourly: '',
        rental_rate_daily: '',
        rental_rate_weekly: '',
        rental_rate_monthly: '',
        minimum_rental_period: 'day',
        description: '',
        images: [],
        insurance_included: false,
        delivery_available: false,
        delivery_radius: '',
        delivery_fee: ''
      });
      
      fetchMyEquipment();
      toast.success('Equipment listed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create equipment listing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRentEquipment = async (equipmentId) => {
    if (!rentalForm.start_date || !rentalForm.rental_duration) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formData = {
        ...rentalForm,
        equipment_id: equipmentId,
        rental_duration: parseInt(rentalForm.rental_duration),
        start_date: new Date(rentalForm.start_date).toISOString()
      };
      
      await axios.post(`${API}/equipment/${equipmentId}/rent`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setRentalForm({
        equipment_id: '',
        rental_period: 'daily',
        rental_duration: 1,
        start_date: '',
        delivery_required: false,
        delivery_address: '',
        special_instructions: ''
      });
      
      fetchEquipment();
      toast.success('Equipment rental booked successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book equipment rental');
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

  const getEquipmentIcon = (type) => {
    const icons = {
      truck: <Truck className="w-6 h-6" />,
      trailer: <Package className="w-6 h-6" />,
      forklift: <Settings className="w-6 h-6" />,
      crane: <Settings className="w-6 h-6" />,
      excavator: <Settings className="w-6 h-6" />
    };
    return icons[type] || <Settings className="w-6 h-6" />;
  };

  const renderRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment Marketplace</h1>
          <p className="text-gray-600">Rent or list construction and logistics equipment</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Equipment</TabsTrigger>
          {user.user_type === 'equipment_owner' && <TabsTrigger value="my-equipment">My Equipment</TabsTrigger>}
          {user.user_type === 'equipment_owner' && <TabsTrigger value="rentals">My Rentals</TabsTrigger>}
          {user.user_type === 'equipment_owner' && <TabsTrigger value="add">Add Equipment</TabsTrigger>}
        </TabsList>

        {/* Browse Equipment */}
        <TabsContent value="browse" className="space-y-6">
          <div className="grid gap-6">
            {equipment.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        {getEquipmentIcon(item.equipment_type)}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{item.name}</CardTitle>
                        <CardDescription className="text-base">
                          {item.brand} {item.model} ({item.year})
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-2">
                        {item.status.toUpperCase()}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        {renderRatingStars(item.rating)}
                        <span className="text-sm text-gray-500">({item.total_reviews})</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-gray-500">Type</Label>
                      <p className="font-medium capitalize">{item.equipment_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Location</Label>
                      <p className="font-medium">{item.location}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Daily Rate</Label>
                      <p className="font-medium text-green-600">{formatCurrency(item.rental_rate_daily)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Minimum Period</Label>
                      <p className="font-medium capitalize">{item.minimum_rental_period}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label className="text-sm text-gray-500">Description</Label>
                    <p className="mt-1">{item.description}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.insurance_included && (
                      <Badge variant="secondary">Insurance Included</Badge>
                    )}
                    {item.delivery_available && (
                      <Badge variant="secondary">Delivery Available</Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Hourly: </span>
                      <span className="font-medium">{formatCurrency(item.rental_rate_hourly)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Daily: </span>
                      <span className="font-medium">{formatCurrency(item.rental_rate_daily)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Weekly: </span>
                      <span className="font-medium">{formatCurrency(item.rental_rate_weekly)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Monthly: </span>
                      <span className="font-medium">{formatCurrency(item.rental_rate_monthly)}</span>
                    </div>
                  </div>
                </CardContent>
                
                {item.status === 'available' && user.user_type !== 'equipment_owner' && (
                  <CardFooter>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-yellow-400 text-black hover:bg-yellow-500">
                          <Calendar className="w-4 h-4 mr-2" />
                          Rent Equipment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Rent {item.name}</DialogTitle>
                          <DialogDescription>
                            Configure your rental details
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="rental-period">Rental Period</Label>
                            <Select value={rentalForm.rental_period} onValueChange={(value) => setRentalForm({...rentalForm, rental_period: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="duration">Duration</Label>
                            <Input
                              id="duration"
                              type="number"
                              min="1"
                              value={rentalForm.rental_duration}
                              onChange={(e) => setRentalForm({...rentalForm, rental_duration: e.target.value})}
                              placeholder="Enter duration"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="start-date">Start Date & Time</Label>
                            <Input
                              id="start-date"
                              type="datetime-local"
                              value={rentalForm.start_date}
                              onChange={(e) => setRentalForm({...rentalForm, start_date: e.target.value})}
                            />
                          </div>
                          
                          {item.delivery_available && (
                            <>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="delivery-required"
                                  checked={rentalForm.delivery_required}
                                  onChange={(e) => setRentalForm({...rentalForm, delivery_required: e.target.checked})}
                                />
                                <Label htmlFor="delivery-required">Delivery Required (+{formatCurrency(item.delivery_fee || 0)})</Label>
                              </div>
                              
                              {rentalForm.delivery_required && (
                                <div>
                                  <Label htmlFor="delivery-address">Delivery Address</Label>
                                  <Input
                                    id="delivery-address"
                                    value={rentalForm.delivery_address}
                                    onChange={(e) => setRentalForm({...rentalForm, delivery_address: e.target.value})}
                                    placeholder="Enter delivery address"
                                  />
                                </div>
                              )}
                            </>
                          )}
                          
                          <div>
                            <Label htmlFor="special-instructions">Special Instructions</Label>
                            <Textarea
                              id="special-instructions"
                              value={rentalForm.special_instructions}
                              onChange={(e) => setRentalForm({...rentalForm, special_instructions: e.target.value})}
                              placeholder="Any special requirements or instructions"
                              rows={3}
                            />
                          </div>
                          
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Estimated Total:</span>
                              <span className="text-lg font-bold text-green-600">
                                {formatCurrency(
                                  (rentalForm.rental_period === 'hourly' ? item.rental_rate_hourly :
                                   rentalForm.rental_period === 'daily' ? item.rental_rate_daily :
                                   rentalForm.rental_period === 'weekly' ? item.rental_rate_weekly :
                                   item.rental_rate_monthly) * (parseInt(rentalForm.rental_duration) || 1) +
                                  (rentalForm.delivery_required ? (item.delivery_fee || 0) : 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button
                            onClick={() => handleRentEquipment(item.id)}
                            disabled={isLoading}
                            className="bg-yellow-400 text-black hover:bg-yellow-500"
                          >
                            {isLoading ? 'Booking...' : 'Book Rental'}
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

        {/* Add Equipment (Equipment Owners) */}
        {user.user_type === 'equipment_owner' && (
          <TabsContent value="add" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>List New Equipment</CardTitle>
                <CardDescription>Add your equipment to the marketplace</CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleCreateEquipment} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="equipment-name">Equipment Name</Label>
                      <Input
                        id="equipment-name"
                        value={equipmentForm.name}
                        onChange={(e) => setEquipmentForm({...equipmentForm, name: e.target.value})}
                        placeholder="e.g., Heavy Duty Excavator"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="equipment-type">Equipment Type</Label>
                      <Select value={equipmentForm.equipment_type} onValueChange={(value) => setEquipmentForm({...equipmentForm, equipment_type: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="trailer">Trailer</SelectItem>
                          <SelectItem value="van">Van</SelectItem>
                          <SelectItem value="forklift">Forklift</SelectItem>
                          <SelectItem value="crane">Crane</SelectItem>
                          <SelectItem value="excavator">Excavator</SelectItem>
                          <SelectItem value="container">Container</SelectItem>
                          <SelectItem value="flatbed">Flatbed</SelectItem>
                          <SelectItem value="refrigerated">Refrigerated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="brand">Brand</Label>
                      <Input
                        id="brand"
                        value={equipmentForm.brand}
                        onChange={(e) => setEquipmentForm({...equipmentForm, brand: e.target.value})}
                        placeholder="e.g., Caterpillar"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={equipmentForm.model}
                        onChange={(e) => setEquipmentForm({...equipmentForm, model: e.target.value})}
                        placeholder="e.g., 320D"
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
                        value={equipmentForm.year}
                        onChange={(e) => setEquipmentForm({...equipmentForm, year: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={equipmentForm.location}
                      onChange={(e) => setEquipmentForm({...equipmentForm, location: e.target.value})}
                      placeholder="City, State"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={equipmentForm.description}
                      onChange={(e) => setEquipmentForm({...equipmentForm, description: e.target.value})}
                      placeholder="Detailed description of the equipment, its condition, and features"
                      rows={4}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="hourly-rate">Hourly Rate ($)</Label>
                      <Input
                        id="hourly-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={equipmentForm.rental_rate_hourly}
                        onChange={(e) => setEquipmentForm({...equipmentForm, rental_rate_hourly: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="daily-rate">Daily Rate ($)</Label>
                      <Input
                        id="daily-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={equipmentForm.rental_rate_daily}
                        onChange={(e) => setEquipmentForm({...equipmentForm, rental_rate_daily: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="weekly-rate">Weekly Rate ($)</Label>
                      <Input
                        id="weekly-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={equipmentForm.rental_rate_weekly}
                        onChange={(e) => setEquipmentForm({...equipmentForm, rental_rate_weekly: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly-rate">Monthly Rate ($)</Label>
                      <Input
                        id="monthly-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={equipmentForm.rental_rate_monthly}
                        onChange={(e) => setEquipmentForm({...equipmentForm, rental_rate_monthly: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min-period">Minimum Rental Period</Label>
                      <Select value={equipmentForm.minimum_rental_period} onValueChange={(value) => setEquipmentForm({...equipmentForm, minimum_rental_period: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hour">Hour</SelectItem>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="insurance-included"
                          checked={equipmentForm.insurance_included}
                          onChange={(e) => setEquipmentForm({...equipmentForm, insurance_included: e.target.checked})}
                        />
                        <Label htmlFor="insurance-included">Insurance Included</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="delivery-available"
                          checked={equipmentForm.delivery_available}
                          onChange={(e) => setEquipmentForm({...equipmentForm, delivery_available: e.target.checked})}
                        />
                        <Label htmlFor="delivery-available">Delivery Available</Label>
                      </div>
                    </div>
                  </div>
                  
                  {equipmentForm.delivery_available && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="delivery-radius">Delivery Radius (miles)</Label>
                        <Input
                          id="delivery-radius"
                          type="number"
                          min="0"
                          value={equipmentForm.delivery_radius}
                          onChange={(e) => setEquipmentForm({...equipmentForm, delivery_radius: e.target.value})}
                          placeholder="e.g., 50"
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-fee">Delivery Fee ($)</Label>
                        <Input
                          id="delivery-fee"
                          type="number"
                          step="0.01"
                          min="0"
                          value={equipmentForm.delivery_fee}
                          onChange={(e) => setEquipmentForm({...equipmentForm, delivery_fee: e.target.value})}
                          placeholder="e.g., 100"
                        />
                      </div>
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    {isLoading ? 'Listing Equipment...' : 'List Equipment'}
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

export default EquipmentMarketplace;