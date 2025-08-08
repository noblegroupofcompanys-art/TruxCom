import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, Banknote, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TruxCreditWallet = ({ user, token }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('stripe');

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await axios.get(`${API}/trux-credit/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API}/trux-credit/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleAddFunds = async () => {
    if (!addFundsAmount || parseFloat(addFundsAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API}/trux-credit/add-funds`, {
        amount: parseFloat(addFundsAmount),
        payment_method_id: 'demo_payment_method'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAddFundsAmount('');
      fetchBalance();
      fetchTransactions();
      toast.success(`Successfully added $${addFundsAmount} to your TruxCredit wallet!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add funds');
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

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case 'debit':
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case 'transfer':
        return <ArrowUpRight className="w-4 h-4 text-blue-600" />;
      default:
        return <Wallet className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
        return 'text-green-600';
      case 'debit':
        return 'text-red-600';
      case 'transfer':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">TruxCredit Wallet</h1>
          <p className="text-gray-600">Instant payments with zero transaction fees</p>
        </div>
      </div>

      <Tabs defaultValue="wallet" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wallet">My Wallet</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="settings">Payment Settings</TabsTrigger>
        </TabsList>

        {/* My Wallet */}
        <TabsContent value="wallet" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Balance Card */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600"></div>
              <div className="absolute inset-0 bg-black bg-opacity-10"></div>
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Wallet className="w-6 h-6 text-white" />
                    <span className="text-white font-medium">TruxCredit Balance</span>
                  </div>
                  <Badge className="bg-white bg-opacity-20 text-white border-white border-opacity-30">
                    Active
                  </Badge>
                </div>
                <div className="text-4xl font-bold text-white mb-2">
                  {formatCurrency(balance)}
                </div>
                <p className="text-white text-opacity-80 text-sm">
                  Available for instant transactions
                </p>
                <div className="mt-4 text-xs text-white text-opacity-60">
                  Account: ****{user.id.slice(-4)}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage your TruxCredit wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Funds
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Funds to TruxCredit</DialogTitle>
                      <DialogDescription>
                        Add money to your TruxCredit wallet for instant payments
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="amount">Amount ($)</Label>
                        <Input
                          id="amount"
                          type="number"
                          min="10"
                          max="10000"
                          step="0.01"
                          value={addFundsAmount}
                          onChange={(e) => setAddFundsAmount(e.target.value)}
                          placeholder="Enter amount"
                        />
                        <p className="text-sm text-gray-500 mt-1">Minimum: $10, Maximum: $10,000</p>
                      </div>
                      <div>
                        <Label htmlFor="payment-method">Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stripe">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="w-4 h-4" />
                                <span>Credit/Debit Card</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="bank">
                              <div className="flex items-center space-x-2">
                                <Banknote className="w-4 h-4" />
                                <span>Bank Transfer</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {addFundsAmount && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between text-sm">
                            <span>Amount:</span>
                            <span>{formatCurrency(parseFloat(addFundsAmount) || 0)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Processing Fee:</span>
                            <span className="text-green-600">$0.00</span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-medium">
                              <span>Total:</span>
                              <span>{formatCurrency(parseFloat(addFundsAmount) || 0)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleAddFunds}
                        disabled={isLoading || !addFundsAmount}
                        className="bg-yellow-400 text-black hover:bg-yellow-500"
                      >
                        {isLoading ? 'Processing...' : `Add ${formatCurrency(parseFloat(addFundsAmount) || 0)}`}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" className="w-full" disabled>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Send Money
                  <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                </Button>

                <Button variant="outline" className="w-full" disabled>
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Request Money
                  <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>TruxCredit Benefits</CardTitle>
              <CardDescription>Why use TruxCredit for your transactions?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Zero Fees</h3>
                    <p className="text-sm text-gray-600">No transaction fees for TruxCredit payments</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Instant Payments</h3>
                    <p className="text-sm text-gray-600">Payments process in under 60 seconds</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Wallet className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Secure</h3>
                    <p className="text-sm text-gray-600">Bank-level security and encryption</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your TruxCredit transaction history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No transactions yet</p>
                    <p className="text-sm text-gray-400">Your TruxCredit transactions will appear here</p>
                  </div>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          {getTransactionIcon(transaction.transaction_type)}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <p className={`font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                            {transaction.transaction_type === 'debit' ? '-' : '+'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </p>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(transaction.status)}
                            <span className="text-xs text-gray-500 capitalize">
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your payment methods for adding funds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-6 h-6 text-gray-600" />
                      <div>
                        <p className="font-medium">Credit Card</p>
                        <p className="text-sm text-gray-500">**** **** **** 4242</p>
                      </div>
                    </div>
                    <Badge variant="outline">Primary</Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Method
                  <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your wallet security preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Enable
                    <Badge variant="secondary" className="ml-2 text-xs">Soon</Badge>
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Transaction Notifications</p>
                    <p className="text-sm text-gray-500">Get notified of all transactions</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Enabled
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily Spending Limit</p>
                    <p className="text-sm text-gray-500">Set a daily transaction limit</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Set Limit
                    <Badge variant="secondary" className="ml-2 text-xs">Soon</Badge>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TruxCreditWallet;