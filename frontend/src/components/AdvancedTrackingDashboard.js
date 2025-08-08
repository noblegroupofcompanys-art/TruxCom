import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { MapPin, Navigation, AlertTriangle, Clock, Target, TrendingUp } from 'lucide-react';
import axios from 'axios';

const AdvancedTrackingDashboard = ({ user, token, shipments, onRefreshShipments }) => {
  const [trackingData, setTrackingData] = useState({
    geofences: [],
    routeDeviations: [],
    etaCalculations: {}
  });
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius: 500,
    event_type: 'pickup',
    alert_on_entry: true,
    alert_on_exit: true
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (shipments.length > 0) {
      loadTrackingData();
    }
  }, [shipments, token]);

  const loadTrackingData = async () => {
    try {
      const trackingPromises = shipments
        .filter(s => s.status === 'in_transit' || s.status === 'booked')
        .map(async (shipment) => {
          const [geofences, deviations, eta] = await Promise.allSettled([
            axios.get(`${BACKEND_URL}/api/shipments/${shipment.id}/geofences`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get(`${BACKEND_URL}/api/shipments/${shipment.id}/route-deviations`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get(`${BACKEND_URL}/api/shipments/${shipment.id}/eta`, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => ({ value: { data: null } }))
          ]);

          return {
            shipmentId: shipment.id,
            geofences: geofences.status === 'fulfilled' ? geofences.value.data : [],
            deviations: deviations.status === 'fulfilled' ? deviations.value.data : [],
            eta: eta.status === 'fulfilled' ? eta.value.data : null
          };
        });

      const results = await Promise.all(trackingPromises);
      
      const consolidated = results.reduce((acc, result) => {
        acc.geofences.push(...result.geofences.map(g => ({ ...g, shipmentId: result.shipmentId })));
        acc.routeDeviations.push(...result.deviations.map(d => ({ ...d, shipmentId: result.shipmentId })));
        if (result.eta) {
          acc.etaCalculations[result.shipmentId] = result.eta;
        }
        return acc;
      }, { geofences: [], routeDeviations: [], etaCalculations: {} });

      setTrackingData(consolidated);
    } catch (error) {
      console.error('Error loading tracking data:', error);
    }
  };

  const createGeofence = async () => {
    if (!selectedShipment || !newGeofence.name || !newGeofence.latitude || !newGeofence.longitude) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const geofenceData = {
        ...newGeofence,
        shipment_id: selectedShipment.id,
        latitude: parseFloat(newGeofence.latitude),
        longitude: parseFloat(newGeofence.longitude),
        notification_recipients: [user.id]
      };

      await axios.post(
        `${BACKEND_URL}/api/shipments/${selectedShipment.id}/geofences`,
        geofenceData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNewGeofence({
        name: '',
        latitude: '',
        longitude: '',
        radius: 500,
        event_type: 'pickup',
        alert_on_entry: true,
        alert_on_exit: true
      });

      await loadTrackingData();
      alert('Geofence created successfully!');
    } catch (error) {
      console.error('Error creating geofence:', error);
      alert('Error creating geofence: ' + (error.response?.data?.detail || error.message));
    }
  };

  const acknowledgeDeviation = async (deviationId, shipmentId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/shipments/${shipmentId}/route-deviations/${deviationId}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadTrackingData();
    } catch (error) {
      console.error('Error acknowledging deviation:', error);
    }
  };

  const formatDelay = (minutes) => {
    if (minutes === 0) return 'On time';
    if (minutes > 0) return `${minutes}m delay`;
    return `${Math.abs(minutes)}m early`;
  };

  const getDeviationSeverityColor = (severity) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800';
      case 'moderate': return 'bg-orange-100 text-orange-800';
      case 'major': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeShipments = shipments.filter(s => s.status === 'in_transit' || s.status === 'booked');

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Geofences</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trackingData.geofences.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Route Deviations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trackingData.routeDeviations.filter(d => !d.acknowledged).length}
            </div>
            <p className="text-xs text-muted-foreground">Unacknowledged</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delayed Shipments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(trackingData.etaCalculations).filter(eta => eta.delay_minutes > 30).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tracking Coverage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeShipments.length > 0 ? Math.round((Object.keys(trackingData.etaCalculations).length / activeShipments.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="geofences" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geofences">Geofences</TabsTrigger>
          <TabsTrigger value="deviations">Route Deviations</TabsTrigger>
          <TabsTrigger value="eta">ETA Tracking</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="geofences" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Geofence Management</h3>
            {user.user_type === 'shipper' && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Create Geofence</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Geofence</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="shipment-select">Select Shipment</Label>
                      <select
                        id="shipment-select"
                        className="w-full px-3 py-2 border rounded-md"
                        value={selectedShipment?.id || ''}
                        onChange={(e) => setSelectedShipment(activeShipments.find(s => s.id === e.target.value))}
                      >
                        <option value="">Select a shipment...</option>
                        {activeShipments.map(shipment => (
                          <option key={shipment.id} value={shipment.id}>
                            {shipment.origin_address} → {shipment.destination_address}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="geofence-name">Geofence Name</Label>
                      <Input
                        id="geofence-name"
                        value={newGeofence.name}
                        onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                        placeholder="e.g., Pickup Location"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={newGeofence.latitude}
                          onChange={(e) => setNewGeofence({...newGeofence, latitude: e.target.value})}
                          placeholder="40.7128"
                        />
                      </div>
                      <div>
                        <Label htmlFor="longitude">Longitude</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          value={newGeofence.longitude}
                          onChange={(e) => setNewGeofence({...newGeofence, longitude: e.target.value})}
                          placeholder="-74.0060"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="radius">Radius (meters)</Label>
                      <Input
                        id="radius"
                        type="number"
                        value={newGeofence.radius}
                        onChange={(e) => setNewGeofence({...newGeofence, radius: parseInt(e.target.value)})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="event-type">Event Type</Label>
                      <select
                        id="event-type"
                        className="w-full px-3 py-2 border rounded-md"
                        value={newGeofence.event_type}
                        onChange={(e) => setNewGeofence({...newGeofence, event_type: e.target.value})}
                      >
                        <option value="pickup">Pickup</option>
                        <option value="delivery">Delivery</option>
                        <option value="checkpoint">Checkpoint</option>
                        <option value="rest_area">Rest Area</option>
                        <option value="restricted_zone">Restricted Zone</option>
                      </select>
                    </div>
                    
                    <Button onClick={createGeofence} className="w-full">Create Geofence</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-4">
            {trackingData.geofences.map((geofence) => {
              const shipment = shipments.find(s => s.id === geofence.shipmentId);
              return (
                <Card key={geofence.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{geofence.name}</h4>
                        <p className="text-sm text-gray-600">
                          {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Unknown Shipment'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Lat: {geofence.latitude.toFixed(4)}, Lon: {geofence.longitude.toFixed(4)} | Radius: {geofence.radius}m
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="capitalize">
                          {geofence.event_type.replace('_', ' ')}
                        </Badge>
                        <div className="text-right text-xs text-gray-500">
                          {geofence.active ? (
                            <span className="text-green-600">Active</span>
                          ) : (
                            <span className="text-gray-400">Inactive</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {trackingData.geofences.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No geofences created yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deviations" className="space-y-4">
          <h3 className="text-lg font-semibold">Route Deviations</h3>
          <div className="grid gap-4">
            {trackingData.routeDeviations.map((deviation) => {
              const shipment = shipments.find(s => s.id === deviation.shipmentId);
              return (
                <Card key={deviation.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <Badge className={getDeviationSeverityColor(deviation.severity)}>
                            {deviation.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">Route Deviation</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Unknown Shipment'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Deviation: {Math.round(deviation.deviation_distance)}m off planned route
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(deviation.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!deviation.acknowledged && user.user_type === 'shipper' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeDeviation(deviation.id, deviation.shipmentId)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {deviation.acknowledged && (
                          <span className="text-xs text-green-600">Acknowledged</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {trackingData.routeDeviations.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No route deviations detected</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="eta" className="space-y-4">
          <h3 className="text-lg font-semibold">ETA Tracking</h3>
          <div className="grid gap-4">
            {Object.entries(trackingData.etaCalculations).map(([shipmentId, eta]) => {
              const shipment = shipments.find(s => s.id === shipmentId);
              return (
                <Card key={shipmentId}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">
                          {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Unknown Shipment'}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span>Current ETA: {new Date(eta.current_eta).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Navigation className="w-4 h-4 text-gray-500" />
                            <span>Original ETA: {new Date(eta.original_eta).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span>Confidence: {Math.round(eta.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={eta.delay_minutes > 30 ? "destructive" : eta.delay_minutes > 0 ? "default" : "secondary"}>
                          {formatDelay(eta.delay_minutes)}
                        </Badge>
                        {eta.factors && eta.factors.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Factors: {eta.factors.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {Object.keys(trackingData.etaCalculations).length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No ETA calculations available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <h3 className="text-lg font-semibold">Active Alerts</h3>
          <div className="grid gap-4">
            {/* Combine unacknowledged deviations and delayed shipments */}
            {trackingData.routeDeviations
              .filter(d => !d.acknowledged)
              .concat(
                Object.entries(trackingData.etaCalculations)
                  .filter(([, eta]) => eta.delay_minutes > 30)
                  .map(([shipmentId, eta]) => ({
                    id: `eta-${shipmentId}`,
                    type: 'eta_delay',
                    shipmentId,
                    eta,
                    severity: eta.delay_minutes > 60 ? 'major' : 'moderate'
                  }))
              )
              .map((alert) => {
                const shipment = shipments.find(s => s.id === alert.shipmentId);
                return (
                  <Card key={alert.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          alert.severity === 'major' ? 'text-red-500' : 
                          alert.severity === 'moderate' ? 'text-orange-500' : 'text-yellow-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={getDeviationSeverityColor(alert.severity)}>
                              {alert.severity?.toUpperCase() || 'ALERT'}
                            </Badge>
                            <span className="font-medium">
                              {alert.type === 'eta_delay' ? 'Delivery Delay' : 'Route Deviation'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Unknown Shipment'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {alert.type === 'eta_delay' 
                              ? `Delayed by ${alert.eta.delay_minutes} minutes`
                              : `${Math.round(alert.deviation_distance)}m off planned route`
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            
            {trackingData.routeDeviations.filter(d => !d.acknowledged).length === 0 &&
             Object.values(trackingData.etaCalculations).filter(eta => eta.delay_minutes > 30).length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No active alerts</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedTrackingDashboard;