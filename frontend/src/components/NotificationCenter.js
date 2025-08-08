import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Bell, Check, MessageSquare, Package, Truck, MapPin } from 'lucide-react';

const NotificationCenter = ({ notifications = [], onMarkAsRead, onMarkAllAsRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    const icons = {
      bid_received: <Package className="w-4 h-4 text-blue-600" />,
      bid_accepted: <Check className="w-4 h-4 text-green-600" />,
      message_received: <MessageSquare className="w-4 h-4 text-purple-600" />,
      shipment_update: <Truck className="w-4 h-4 text-orange-600" />,
      location_alert: <MapPin className="w-4 h-4 text-yellow-600" />,
      shipment_delivered: <Check className="w-4 h-4 text-green-600" />
    };
    return icons[type] || <Bell className="w-4 h-4 text-gray-600" />;
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 text-xs flex items-center justify-center bg-red-500">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notification panel */}
          <div className="absolute right-0 top-full mt-2 w-96 z-50">
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMarkAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${
                            notification.read 
                              ? 'border-transparent bg-white' 
                              : 'border-yellow-400 bg-yellow-50'
                          }`}
                          onClick={() => {
                            if (!notification.read) {
                              onMarkAsRead(notification.id);
                            }
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className={`text-sm font-medium ${
                                  notification.read ? 'text-gray-900' : 'text-black'
                                }`}>
                                  {notification.title}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {formatTime(notification.created_at)}
                                </span>
                              </div>
                              <p className={`text-xs ${
                                notification.read ? 'text-gray-600' : 'text-gray-800'
                              }`}>
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;