import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  FileText,
  Settings,
  Eye,
  Upload,
  Download,
  MessageSquare,
  Star
} from 'lucide-react';
import axios from 'axios';

const AdminDashboard = ({ user, token }) => {
  const [adminData, setAdminData] = useState({
    kycVerifications: [],
    disputes: [],
    commissionRules: [],
    analytics: {},
    pricingTemplates: []
  });
  
  const [loading, setLoading] = useState(false);
  
  const [disputeForm, setDisputeForm] = useState({
    respondent_id: '',
    related_type: 'shipment',
    related_id: '',
    dispute_type: 'payment',
    title: '',
    description: '',
    amount_disputed: ''
  });

  const [pricingForm, setPricingForm] = useState({
    service_type: 'training',
    service_id: '',
    new_price: ''
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Check if user is admin
  const isAdmin = user.user_type === 'admin' || user.user_type === 'super_admin';

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [token, isAdmin]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, commissionRes, pricingRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/api/analytics/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/commission/rules`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/admin/pricing/templates`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setAdminData({
        analytics: analyticsRes.status === 'fulfilled' ? analyticsRes.value.data : {},
        commissionRules: commissionRes.status === 'fulfilled' ? commissionRes.value.data : [],
        pricingTemplates: pricingRes.status === 'fulfilled' ? pricingRes.value.data : [],
        kycVerifications: [],
        disputes: []
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyKYC = async (userId, status, notes) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/kyc/verify/${userId}?verification_status=${status}&notes=${encodeURIComponent(notes)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('KYC verification updated successfully!');
      await loadAdminData();
    } catch (error) {
      console.error('Error verifying KYC:', error);
      alert('Error updating KYC verification');
    }
  };

  const createDispute = async () => {
    if (!disputeForm.title || !disputeForm.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const disputeParams = new URLSearchParams({
        respondent_id: disputeForm.respondent_id || 'test-user',
        related_type: disputeForm.related_type,
        related_id: disputeForm.related_id || 'test-id',
        dispute_type: disputeForm.dispute_type,
        title: disputeForm.title,
        description: disputeForm.description,
        amount_disputed: disputeForm.amount_disputed || '0'
      });

      await axios.post(
        `${BACKEND_URL}/api/admin/disputes/create?${disputeParams}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDisputeForm({
        respondent_id: '',
        related_type: 'shipment',
        related_id: '',
        dispute_type: 'payment',
        title: '',
        description: '',
        amount_disputed: ''
      });

      alert('Dispute case created successfully!');
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert('Error creating dispute case');
    }
  };

  const updatePricing = async () => {
    if (!pricingForm.service_id || !pricingForm.new_price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/pricing/update/${pricingForm.service_type}?service_id=${pricingForm.service_id}&new_price=${pricingForm.new_price}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPricingForm({
        service_type: 'training',
        service_id: '',
        new_price: ''
      });

      alert('Pricing updated successfully!');
    } catch (error) {
      console.error('Error updating pricing:', error);
      alert('Error updating pricing');
    }
  };

  const generateReport = async (reportType) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await axios.post(
        `${BACKEND_URL}/api/analytics/reports/generate`,
        {
          report_type: reportType,
          report_period_start: startDate.toISOString(),
          report_period_end: endDate.toISOString(),
          parameters: {}
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`${reportType} report generated successfully! Report ID: ${response.data.report_id}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': case 'active': case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': case 'expired': return 'bg-red-100 text-red-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">Admin Access Required</h3>
          <p className="text-gray-500">You need administrator privileges to access this dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(adminData.analytics.overview?.total_revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              +{adminData.analytics.overview?.growth_rate || 0}% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminData.analytics.overview?.total_users || 0}
            </div>
            <p className="text-xs text-muted-foreground">Platform-wide users</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shipments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminData.analytics.overview?.active_shipments || 0}
            </div>
            <p className="text-xs text-muted-foreground">In-transit and booked</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rules</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminData.commissionRules.length}
            </div>
            <p className="text-xs text-muted-foreground">Active rules</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="kyc">KYC Management</TabsTrigger>
          <TabsTrigger value="disputes">Dispute Resolution</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Control</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <h3 className="text-lg font-semibold">Platform Analytics</h3>
          
          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>Revenue by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adminData.analytics.revenue_breakdown && Object.entries(adminData.analytics.revenue_breakdown).map(([service, amount]) => (
                  <div key={service} className="flex justify-between items-center">
                    <span className="capitalize">{service.replace('_', ' ')}</span>
                    <span className="font-semibold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Predictive Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => window.open(`${BACKEND_URL}/api/analytics/predictive/demand_forecast`, '_blank')}
            >
              <TrendingUp className="w-6 h-6 mb-2" />
              <span>Demand Forecast</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => window.open(`${BACKEND_URL}/api/analytics/predictive/price_prediction`, '_blank')}
            >
              <DollarSign className="w-6 h-6 mb-2" />
              <span>Price Prediction</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => window.open(`${BACKEND_URL}/api/analytics/predictive/risk_assessment`, '_blank')}
            >
              <AlertTriangle className="w-6 h-6 mb-2" />
              <span>Risk Assessment</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">KYC Management</h3>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Verify
            </Button>
          </div>

          {/* KYC Mock Data */}
          <div className="grid gap-4">
            {[
              {
                id: '1',
                user_name: 'John Doe',
                email: 'john@example.com',
                verification_status: 'pending',
                submitted_docs: ['drivers_license', 'business_license'],
                score: 75
              },
              {
                id: '2', 
                user_name: 'Jane Smith',
                email: 'jane@example.com',
                verification_status: 'verified',
                submitted_docs: ['passport', 'business_license', 'insurance_certificate'],
                score: 95
              }
            ].map((verification) => (
              <Card key={verification.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{verification.user_name}</span>
                        <Badge className={getStatusColor(verification.verification_status)}>
                          {verification.verification_status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{verification.email}</p>
                      <div className="text-sm text-gray-500">
                        <p>Documents: {verification.submitted_docs.join(', ')}</p>
                        <p>Verification Score: {verification.score}/100</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => verifyKYC(verification.id, 'verified', 'Documents verified successfully')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => verifyKYC(verification.id, 'rejected', 'Additional documentation required')}
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Dispute Resolution</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Create Dispute
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Dispute Case</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Related Type</Label>
                      <Select
                        value={disputeForm.related_type}
                        onValueChange={(value) => setDisputeForm({...disputeForm, related_type: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shipment">Shipment</SelectItem>
                          <SelectItem value="payment">Payment</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Dispute Type</Label>
                      <Select
                        value={disputeForm.dispute_type}
                        onValueChange={(value) => setDisputeForm({...disputeForm, dispute_type: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payment">Payment</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="damage">Damage</SelectItem>
                          <SelectItem value="service_quality">Service Quality</SelectItem>
                          <SelectItem value="fraud">Fraud</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={disputeForm.title}
                      onChange={(e) => setDisputeForm({...disputeForm, title: e.target.value})}
                      placeholder="Brief dispute title"
                    />
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={disputeForm.description}
                      onChange={(e) => setDisputeForm({...disputeForm, description: e.target.value})}
                      placeholder="Detailed description of the dispute"
                      rows={4}
                    />
                  </div>
                  
                  <div>
                    <Label>Amount Disputed (optional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={disputeForm.amount_disputed}
                      onChange={(e) => setDisputeForm({...disputeForm, amount_disputed: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <Button onClick={createDispute} className="w-full">
                    Create Dispute Case
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Mock Dispute Cases */}
          <div className="grid gap-4">
            {[
              {
                case_number: 'DSP-20231201-ABC123',
                title: 'Payment not received',
                dispute_type: 'payment',
                status: 'under_review',
                amount_disputed: 2500,
                created_at: new Date()
              }
            ].map((dispute, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span className="font-medium">{dispute.case_number}</span>
                        <Badge className={getStatusColor(dispute.status)}>
                          {dispute.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <h4 className="font-semibold mb-1">{dispute.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Type: {dispute.dispute_type} | Amount: {formatCurrency(dispute.amount_disputed)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Created: {dispute.created_at.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Messages
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="commission" className="space-y-4">
          <h3 className="text-lg font-semibold">Commission Management</h3>
          
          <div className="grid gap-4">
            {adminData.commissionRules.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">No commission rules configured</p>
                </CardContent>
              </Card>
            ) : (
              adminData.commissionRules.map((rule, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-medium capitalize">
                            {rule.service_type} Commission
                          </span>
                          <Badge variant="outline">
                            {rule.commission_rate}% 
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          Type: {rule.commission_type} | 
                          Users: {rule.user_types?.join(', ') || 'All'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Effective: {new Date(rule.effective_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Pricing Control Center</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Settings className="w-4 h-4 mr-2" />
                  Update Pricing
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Service Pricing</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Service Type</Label>
                    <Select
                      value={pricingForm.service_type}
                      onValueChange={(value) => setPricingForm({...pricingForm, service_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="training">Training Courses</SelectItem>
                        <SelectItem value="insurance">Insurance Plans</SelectItem>
                        <SelectItem value="commission">Commission Rates</SelectItem>
                        <SelectItem value="platform_fee">Platform Fees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Service ID</Label>
                    <Input
                      value={pricingForm.service_id}
                      onChange={(e) => setPricingForm({...pricingForm, service_id: e.target.value})}
                      placeholder="Enter service ID"
                    />
                  </div>
                  
                  <div>
                    <Label>New Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pricingForm.new_price}
                      onChange={(e) => setPricingForm({...pricingForm, new_price: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <Button onClick={updatePricing} className="w-full">
                    Update Pricing
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {adminData.pricingTemplates.map((template, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Settings className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{template.template_name}</span>
                        <Badge variant="outline" className="capitalize">
                          {template.service_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Currency: {template.currency}
                      </p>
                      <p className="text-xs text-gray-500">
                        Updated: {new Date(template.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {adminData.pricingTemplates.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">No pricing templates configured</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <h3 className="text-lg font-semibold">Report Generation</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:bg-gray-50" onClick={() => generateReport('financial')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <DollarSign className="w-12 h-12 text-green-500 mb-4" />
                  <h4 className="font-semibold mb-2">Financial Report</h4>
                  <p className="text-sm text-gray-600">Revenue, costs, and profit analysis</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50" onClick={() => generateReport('operational')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <TrendingUp className="w-12 h-12 text-blue-500 mb-4" />
                  <h4 className="font-semibold mb-2">Operational Report</h4>
                  <p className="text-sm text-gray-600">Shipments, performance metrics</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50" onClick={() => generateReport('user_engagement')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Users className="w-12 h-12 text-purple-500 mb-4" />
                  <h4 className="font-semibold mb-2">User Engagement</h4>
                  <p className="text-sm text-gray-600">User activity and retention</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No recent reports available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;