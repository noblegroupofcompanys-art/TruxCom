import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom truck icon
const truckIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDEzSDE2TDE5IDEwVjZIMTRWMTNaIiBzdHJva2U9IiNmZmZmMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSIjZmZmZjAwIi8+CjxwYXRoIGQ9Ik01IDExVjZIMTQiIHN0cm9rZT0iI2ZmZmYwMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGZpbGw9IiNmZmZmMDAiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMTdNMTcgMTdNNSAxMUgxOUw0IDE3TDE5IDE3VjlINVYxNyIgc3Ryb2tlPSIjZmZmZjAwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0iI2ZmZmYwMCIvPgo8L3N2Zz4K',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const MapView = ({ shipment, currentLocation, className = "" }) => {
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to New York
  const [routeLine, setRouteLine] = useState([]);

  // Mock coordinates for major cities
  const getCityCoordinates = (address) => {
    const cityCoords = {
      "New York, NY": [40.7128, -74.0060],
      "Los Angeles, CA": [34.0522, -118.2437],
      "Chicago, IL": [41.8781, -87.6298],
      "Houston, TX": [29.7604, -95.3698],
      "Miami, FL": [25.7617, -80.1918],
      "Atlanta, GA": [33.7490, -84.3880],
      "Denver, CO": [39.7392, -104.9903],
      "Seattle, WA": [47.6062, -122.3321]
    };
    
    return cityCoords[address] || [40.7128, -74.0060];
  };

  useEffect(() => {
    if (shipment) {
      const originCoords = getCityCoordinates(shipment.origin_address);
      const destCoords = getCityCoordinates(shipment.destination_address);
      
      // Set map center to midpoint of route
      const centerLat = (originCoords[0] + destCoords[0]) / 2;
      const centerLng = (originCoords[1] + destCoords[1]) / 2;
      setMapCenter([centerLat, centerLng]);
      
      // Create route line
      setRouteLine([originCoords, destCoords]);
    }
  }, [shipment]);

  if (!shipment) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">No shipment data available</p>
      </div>
    );
  }

  const originCoords = getCityCoordinates(shipment.origin_address);
  const destCoords = getCityCoordinates(shipment.destination_address);
  const currentPos = currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null;

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={mapCenter}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Origin marker */}
        <Marker position={originCoords}>
          <Popup>
            <div>
              <strong>Origin</strong><br />
              {shipment.origin_address}
            </div>
          </Popup>
        </Marker>
        
        {/* Destination marker */}
        <Marker position={destCoords}>
          <Popup>
            <div>
              <strong>Destination</strong><br />
              {shipment.destination_address}
            </div>
          </Popup>
        </Marker>
        
        {/* Current location marker (truck) */}
        {currentPos && (
          <Marker position={currentPos} icon={truckIcon}>
            <Popup>
              <div>
                <strong>Current Location</strong><br />
                Speed: {currentLocation.speed ? `${currentLocation.speed.toFixed(1)} km/h` : 'N/A'}<br />
                Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Route line */}
        {routeLine.length > 0 && (
          <Polyline positions={routeLine} pathOptions={{ color: '#fbbf24', weight: 3, opacity: 0.7 }} />
        )}
      </MapContainer>
      
      {/* Map legend */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000]">
        <div className="space-y-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Origin/Destination</span>
          </div>
          {currentPos && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Current Location</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-yellow-400"></div>
            <span>Route</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;