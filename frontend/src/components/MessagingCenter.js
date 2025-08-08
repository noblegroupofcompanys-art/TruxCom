import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { MessageSquare, Send, User } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MessagingCenter = ({ shipment, currentUser, token, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && shipment && token) {
      fetchMessages();
    }
  }, [isOpen, shipment, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!shipment || !token) return;
    
    try {
      const response = await axios.get(`${API}/messages/shipment/${shipment.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !shipment || !token) return;

    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/messages`, {
        shipment_id: shipment.id,
        content: newMessage.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessages([...messages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getOtherPartyName = () => {
    if (!shipment) return 'Unknown';
    
    if (currentUser.user_type === 'shipper') {
      // Find driver info from shipment
      return shipment.carrier_id ? 'Driver' : 'No driver assigned';
    } else {
      return shipment.shipper_email || 'Shipper';
    }
  };

  const getInitials = (email) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      
      {/* Chat panel */}
      <div className="fixed right-4 bottom-4 top-4 w-96 z-50">
        <Card className="h-full flex flex-col shadow-xl">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <div>
                  <CardTitle className="text-lg">Messages</CardTitle>
                  <p className="text-sm text-gray-500">{getOtherPartyName()}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No messages yet</p>
                    <p className="text-xs">Start a conversation about this shipment</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage = message.sender_id === currentUser.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex max-w-xs lg:max-w-md ${
                          isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                        }`}>
                          <Avatar className="w-8 h-8 mx-2">
                            <AvatarFallback className={`text-xs ${
                              isOwnMessage ? 'bg-yellow-400 text-black' : 'bg-gray-200'
                            }`}>
                              {getInitials(message.sender_email)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className={`px-4 py-2 rounded-2xl ${
                            isOwnMessage 
                              ? 'bg-yellow-400 text-black rounded-br-md' 
                              : 'bg-gray-200 text-black rounded-bl-md'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              isOwnMessage ? 'text-black/70' : 'text-gray-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Message input */}
            <div className="p-4 border-t">
              <form onSubmit={sendMessage} className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isLoading || !newMessage.trim()}
                  className="bg-yellow-400 text-black hover:bg-yellow-500"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MessagingCenter;