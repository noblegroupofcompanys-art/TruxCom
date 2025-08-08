import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Wallet, 
  FileText, 
  Shield, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  CreditCard,
  TrendingUp,
  Eye,
  Send,
  Plus
} from 'lucide-react';
import axios from 'axios';

const InstapayDashboard = ({ user, token, shipments }) => {
  const [instapayData, setInstapayData] = useState({
    escrowAccounts: [],
    sentInvoices: [],
    receivedInvoices: [],
    exchangeRates: {}
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  
  // Form states
  const [escrowForm, setEscrowForm] = useState({
    shipment_id: '',
    amount: '',
    currency: 'USD',
    payment_method: 'stripe'
  });
  
  const [invoiceForm, setInvoiceForm] = useState({
    recipient_id: '',
    related_type: 'shipment',
    related_id: '',
    items: [{
      description: '',
      quantity: 1,
      unit_price: '',
      amount: ''
    }],
    currency: 'USD',
    due_date: '',
    payment_terms: 'Net 30',
    notes: ''
  });
  
  const [users, setUsers] = useState([]);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadInstapayData();
    loadExchangeRates();
    loadUsers();
  }, [token]);

  const loadInstapayData = async () => {
    setLoading(true);
    try {
      const [escrowRes, sentInvoicesRes, receivedInvoicesRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/api/escrow/my-accounts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/invoices/sent`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/invoices/received`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setInstapayData({
        escrowAccounts: escrowRes.status === 'fulfilled' ? escrowRes.value.data : [],
        sentInvoices: sentInvoicesRes.status === 'fulfilled' ? sentInvoicesRes.value.data : [],
        receivedInvoices: receivedInvoicesRes.status === 'fulfilled' ? receivedInvoicesRes.value.data : [],
        exchangeRates: instapayData.exchangeRates
      });
    } catch (error) {
      console.error('Error loading Instapay data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeRates = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/currencies/rates?base_currency=${selectedCurrency}`);
      setInstapayData(prev => ({
        ...prev,
        exchangeRates: { [selectedCurrency]: response.data }
      }));
    } catch (error) {
      console.error('Error loading exchange rates:', error);
    }
  };

  const loadUsers = async () => {
    // This would typically come from a users endpoint
    // For now, we'll extract unique users from shipments
    const uniqueUsers = [];
    shipments.forEach(shipment => {
      if (!uniqueUsers.find(u => u.id === shipment.shipper_id)) {
        uniqueUsers.push({ id: shipment.shipper_id, email: shipment.shipper_email, type: 'shipper' });
      }
      if (shipment.carrier_id && !uniqueUsers.find(u => u.id === shipment.carrier_id)) {
        uniqueUsers.push({ id: shipment.carrier_id, email: 'carrier@example.com', type: 'driver' });
      }
    });
    setUsers(uniqueUsers);
  };

  const createEscrow = async () => {
    if (!escrowForm.shipment_id || !escrowForm.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${BACKEND_URL}/api/escrow/create`, {
        ...escrowForm,
        amount: parseFloat(escrowForm.amount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEscrowForm({
        shipment_id: '',
        amount: '',
        currency: 'USD',
        payment_method: 'stripe'
      });
      
      await loadInstapayData();
      alert('Escrow account created successfully!');
    } catch (error) {
      console.error('Error creating escrow:', error);
      alert('Error creating escrow: ' + (error.response?.data?.detail || error.message));
    }
  };

  const fundEscrow = async (escrowId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/escrow/${escrowId}/fund`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadInstapayData();
      alert('Escrow account funded successfully!');
    } catch (error) {
      console.error('Error funding escrow:', error);
      alert('Error funding escrow: ' + (error.response?.data?.detail || error.message));
    }
  };

  const releaseEscrow = async (escrowId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/escrow/${escrowId}/release`, {
        release_percentage: 100,
        reason: 'delivery_confirmed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadInstapayData();
      alert('Escrow funds released successfully!');
    } catch (error) {
      console.error('Error releasing escrow:', error);
      alert('Error releasing escrow: ' + (error.response?.data?.detail || error.message));
    }
  };

  const createInvoice = async () => {
    if (!invoiceForm.recipient_id || !invoiceForm.related_id || invoiceForm.items.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Calculate item amounts
      const processedItems = invoiceForm.items.map(item => ({
        ...item,
        amount: parseFloat(item.unit_price) * parseInt(item.quantity)
      }));

      const invoiceData = {
        ...invoiceForm,
        items: processedItems,
        due_date: new Date(invoiceForm.due_date).toISOString()
      };

      await axios.post(`${BACKEND_URL}/api/invoices/create`, invoiceData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form
      setInvoiceForm({
        recipient_id: '',
        related_type: 'shipment',
        related_id: '',
        items: [{
          description: '',
          quantity: 1,
          unit_price: '',
          amount: ''
        }],
        currency: 'USD',
        due_date: '',
        payment_terms: 'Net 30',
        notes: ''
      });
      
      await loadInstapayData();
      alert('Invoice created successfully!');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error creating invoice: ' + (error.response?.data?.detail || error.message));
    }
  };

  const sendInvoice = async (invoiceId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/invoices/${invoiceId}/send`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadInstapayData();
      alert('Invoice sent successfully!');
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Error sending invoice: ' + (error.response?.data?.detail || error.message));
    }
  };

  const payInvoice = async (invoiceId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/invoices/${invoiceId}/pay`, {
        payment_method: 'trux_credit',
        currency: 'USD'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadInstapayData();
      alert('Invoice paid successfully!');
    } catch (error) {
      console.error('Error paying invoice:', error);
      alert('Error paying invoice: ' + (error.response?.data?.detail || error.message));
    }
  };

  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, {
        description: '',
        quantity: 1,
        unit_price: '',
        amount: ''
      }]
    });
  };

  const updateInvoiceItem = (index, field, value) => {
    const newItems = [...invoiceForm.items];
    newItems[index][field] = value;
    if (field === 'unit_price' || field === 'quantity') {
      newItems[index].amount = parseFloat(newItems[index].unit_price || 0) * parseInt(newItems[index].quantity || 0);
    }
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  const removeInvoiceItem = (index) => {
    setInvoiceForm({
      ...invoiceForm,
      items: invoiceForm.items.filter((_, i) => i !== index)
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      funded: 'bg-green-100 text-green-800',
      released: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/currencies/convert`, {
        amount,
        from_currency: fromCurrency,
        to_currency: toCurrency
      });
      return response.data;
    } catch (error) {
      console.error('Currency conversion error:', error);
      return null;
    }
  };

  const totalEscrowAmount = instapayData.escrowAccounts
    .filter(account => account.status === 'funded')
    .reduce((sum, account) => sum + account.amount, 0);

  const totalInvoicesAmount = instapayData.sentInvoices
    .filter(invoice => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Escrow</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEscrowAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {instapayData.escrowAccounts.filter(a => a.status === 'funded').length} active accounts
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoice Revenue</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvoicesAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {instapayData.sentInvoices.filter(i => i.status === 'paid').length} paid invoices
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TruxCredit Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(user.trux_credit_balance || 0)}</div>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exchange Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {instapayData.exchangeRates[selectedCurrency]?.rates?.EUR?.toFixed(4) || '0.85'}
            </div>
            <p className="text-xs text-muted-foreground">{selectedCurrency}/EUR</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="escrow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="escrow">Escrow Accounts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="currency">Multi-Currency</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="escrow" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Escrow Management</h3>
            {user.user_type === 'shipper' && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Shield className="w-4 h-4 mr-2" />
                    Create Escrow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Escrow Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select Shipment</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={escrowForm.shipment_id}
                        onChange={(e) => setEscrowForm({...escrowForm, shipment_id: e.target.value})}
                      >
                        <option value="">Select a shipment...</option>
                        {shipments
                          .filter(s => s.status === 'booked' && s.carrier_id)
                          .map(shipment => (
                            <option key={shipment.id} value={shipment.id}>
                              {shipment.origin_address} → {shipment.destination_address} - ${shipment.offered_price}
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={escrowForm.amount}
                        onChange={(e) => setEscrowForm({...escrowForm, amount: e.target.value})}
                        placeholder="2500.00"
                      />
                    </div>
                    
                    <div>
                      <Label>Currency</Label>
                      <Select value={escrowForm.currency} onValueChange={(value) => setEscrowForm({...escrowForm, currency: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={escrowForm.payment_method} onValueChange={(value) => setEscrowForm({...escrowForm, payment_method: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripe">Credit Card (Stripe)</SelectItem>
                          <SelectItem value="trux_credit">TruxCredit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button onClick={createEscrow} className="w-full">
                      Create Escrow Account
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-4">
            {instapayData.escrowAccounts.map((account) => {
              const shipment = shipments.find(s => s.id === account.shipment_id);
              return (
                <Card key={account.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <Badge className={getStatusBadgeColor(account.status)}>
                            {account.status.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{formatCurrency(account.amount, account.currency)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {shipment ? `${shipment.origin_address} → ${shipment.destination_address}` : 'Unknown Shipment'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(account.created_at).toLocaleDateString()}
                        </p>
                        {account.funded_at && (
                          <p className="text-xs text-green-600">
                            Funded: {new Date(account.funded_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {account.status === 'pending' && account.shipper_id === user.id && (
                          <Button size="sm" onClick={() => fundEscrow(account.id)}>
                            <CreditCard className="w-4 h-4 mr-1" />
                            Fund
                          </Button>
                        )}
                        {account.status === 'funded' && (account.shipper_id === user.id || account.carrier_id === user.id) && (
                          <Button size="sm" variant="outline" onClick={() => releaseEscrow(account.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Release
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {instapayData.escrowAccounts.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No escrow accounts yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Invoice Management</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Recipient</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={invoiceForm.recipient_id}
                        onChange={(e) => setInvoiceForm({...invoiceForm, recipient_id: e.target.value})}
                      >
                        <option value="">Select recipient...</option>
                        {users.filter(u => u.id !== user.id).map(u => (
                          <option key={u.id} value={u.id}>{u.email} ({u.type})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <Label>Related Shipment</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={invoiceForm.related_id}
                        onChange={(e) => setInvoiceForm({...invoiceForm, related_id: e.target.value})}
                      >
                        <option value="">Select shipment...</option>
                        {shipments.map(shipment => (
                          <option key={shipment.id} value={shipment.id}>
                            {shipment.origin_address} → {shipment.destination_address}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Invoice Items</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addInvoiceItem}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                    
                    {invoiceForm.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unit_price}
                          onChange={(e) => updateInvoiceItem(index, 'unit_price', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount}
                          readOnly
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeInvoiceItem(index)}
                          disabled={invoiceForm.items.length === 1}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Currency</Label>
                      <Select value={invoiceForm.currency} onValueChange={(value) => setInvoiceForm({...invoiceForm, currency: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.due_date}
                        onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                  
                  <Button onClick={createInvoice} className="w-full">
                    Create Invoice
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="sent" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sent">Sent ({instapayData.sentInvoices.length})</TabsTrigger>
              <TabsTrigger value="received">Received ({instapayData.receivedInvoices.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="sent">
              <div className="grid gap-4">
                {instapayData.sentInvoices.map((invoice) => (
                  <Card key={invoice.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{invoice.invoice_number}</span>
                            <Badge className={getStatusBadgeColor(invoice.status)}>
                              {invoice.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Amount: {formatCurrency(invoice.total_amount, invoice.currency)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due: {new Date(invoice.due_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {invoice.status === 'draft' && (
                            <Button size="sm" onClick={() => sendInvoice(invoice.id)}>
                              <Send className="w-4 h-4 mr-1" />
                              Send
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {instapayData.sentInvoices.length === 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-center text-gray-500">No invoices sent yet</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="received">
              <div className="grid gap-4">
                {instapayData.receivedInvoices.map((invoice) => (
                  <Card key={invoice.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-orange-500" />
                            <span className="font-medium">{invoice.invoice_number}</span>
                            <Badge className={getStatusBadgeColor(invoice.status)}>
                              {invoice.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Amount: {formatCurrency(invoice.total_amount, invoice.currency)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due: {new Date(invoice.due_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            Received: {new Date(invoice.sent_at || invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <Button size="sm" onClick={() => payInvoice(invoice.id)}>
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {instapayData.receivedInvoices.length === 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-center text-gray-500">No invoices received yet</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="currency" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Multi-Currency Support</h3>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current Exchange Rates</CardTitle>
              <CardDescription>Base currency: {selectedCurrency}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {instapayData.exchangeRates[selectedCurrency]?.rates && 
                 Object.entries(instapayData.exchangeRates[selectedCurrency].rates).map(([currency, rate]) => (
                  <Card key={currency}>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{rate.toFixed(4)}</div>
                        <div className="text-sm text-gray-500">{selectedCurrency}/{currency}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Currency Converter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" placeholder="100.00" />
                </div>
                <div>
                  <Label>From Currency</Label>
                  <Select defaultValue="USD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>To Currency</Label>
                  <Select defaultValue="EUR">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-4">Convert</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your TruxCredit transaction history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Transaction history would be displayed here</p>
                <p className="text-xs text-gray-400">This feature connects to your TruxCredit wallet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstapayDashboard;