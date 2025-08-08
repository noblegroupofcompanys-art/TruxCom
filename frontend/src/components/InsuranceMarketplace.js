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
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Clock,
  Star,
  TrendingUp,
  Eye,
  CreditCard
} from 'lucide-react';
import axios from 'axios';

const InsuranceMarketplace = ({ user, token }) => {
  const [insuranceData, setInsuranceData] = useState({
    providers: [],
    plans: [],
    quotes: [],
    policies: [],
    claims: []
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  const [quoteForm, setQuoteForm] = useState({
    plan_id: '',
    coverage_amount: 100000,
    risk_factors: {
      years_experience: 5,
      vehicle_age: 3,
      high_risk_routes: false,
      previous_claims: 0
    }
  });
  
  const [claimForm, setClaimForm] = useState({
    policy_id: '',
    incident_date: '',
    claim_amount: '',
    description: '',
    incident_type: 'cargo_damage'
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadInsuranceData();
  }, [token]);

  const loadInsuranceData = async () => {
    setLoading(true);
    try {
      const [providersRes, plansRes, policiesRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/api/insurance/providers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/insurance/plans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/insurance/my-policies`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setInsuranceData({
        providers: providersRes.status === 'fulfilled' ? providersRes.value.data : [],
        plans: plansRes.status === 'fulfilled' ? plansRes.value.data : [],
        policies: policiesRes.status === 'fulfilled' ? policiesRes.value.data : [],
        quotes: [],
        claims: []
      });
    } catch (error) {
      console.error('Error loading insurance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsuranceQuote = async () => {
    if (!quoteForm.plan_id || !quoteForm.coverage_amount) {
      alert('Please select a plan and enter coverage amount');
      return;
    }

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/insurance/quote?plan_id=${quoteForm.plan_id}&coverage_amount=${quoteForm.coverage_amount}`,
        { risk_factors: quoteForm.risk_factors },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setInsuranceData(prev => ({
        ...prev,
        quotes: [...prev.quotes, response.data]
      }));

      alert('Quote generated successfully!');
    } catch (error) {
      console.error('Error generating quote:', error);
      alert('Error generating quote: ' + (error.response?.data?.detail || error.message));
    }
  };

  const purchasePolicy = async (quoteId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/insurance/purchase/${quoteId}`,
        { payment_method: 'trux_credit' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadInsuranceData();
      alert('Policy purchased successfully!');
    } catch (error) {
      console.error('Error purchasing policy:', error);
      alert('Error purchasing policy: ' + (error.response?.data?.detail || error.message));
    }
  };

  const fileInsuranceClaim = async () => {
    if (!claimForm.policy_id || !claimForm.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const claimParams = new URLSearchParams({
        policy_id: claimForm.policy_id,
        incident_date: claimForm.incident_date || new Date().toISOString(),
        claim_amount: claimForm.claim_amount,
        description: claimForm.description,
        incident_type: claimForm.incident_type
      });

      await axios.post(
        `${BACKEND_URL}/api/insurance/claim?${claimParams}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setClaimForm({
        policy_id: '',
        incident_date: '',
        claim_amount: '',
        description: '',
        incident_type: 'cargo_damage'
      });

      alert('Insurance claim filed successfully!');
    } catch (error) {
      console.error('Error filing claim:', error);
      alert('Error filing claim: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getInsuranceTypeIcon = (type) => {
    switch (type) {
      case 'cargo': return '📦';
      case 'fleet': return '🚛';
      case 'liability': return '⚖️';
      case 'equipment': return '🔧';
      default: return '🛡️';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

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
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insuranceData.policies.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                insuranceData.policies
                  .filter(p => p.status === 'active')
                  .reduce((sum, p) => sum + (p.coverage_amount || 0), 0)
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Premium</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                insuranceData.policies
                  .filter(p => p.status === 'active')
                  .reduce((sum, p) => sum + (p.premium_amount || 0), 0)
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Plans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insuranceData.plans.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="quotes">My Quotes</TabsTrigger>
          <TabsTrigger value="policies">My Policies</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Insurance Marketplace</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Shield className="w-4 h-4 mr-2" />
                  Get Quote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Get Insurance Quote</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Insurance Plan</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={quoteForm.plan_id}
                      onChange={(e) => setQuoteForm({...quoteForm, plan_id: e.target.value})}
                    >
                      <option value="">Select a plan...</option>
                      {insuranceData.plans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {getInsuranceTypeIcon(plan.insurance_type)} {plan.name} - {formatCurrency(plan.base_premium)}/month
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label>Coverage Amount</Label>
                    <Input
                      type="number"
                      value={quoteForm.coverage_amount}
                      onChange={(e) => setQuoteForm({...quoteForm, coverage_amount: parseFloat(e.target.value)})}
                      placeholder="100000"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Years of Experience</Label>
                      <Input
                        type="number"
                        value={quoteForm.risk_factors.years_experience}
                        onChange={(e) => setQuoteForm({
                          ...quoteForm,
                          risk_factors: {
                            ...quoteForm.risk_factors,
                            years_experience: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Vehicle Age (years)</Label>
                      <Input
                        type="number"
                        value={quoteForm.risk_factors.vehicle_age}
                        onChange={(e) => setQuoteForm({
                          ...quoteForm,
                          risk_factors: {
                            ...quoteForm.risk_factors,
                            vehicle_age: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Previous Claims</Label>
                      <Input
                        type="number"
                        value={quoteForm.risk_factors.previous_claims}
                        onChange={(e) => setQuoteForm({
                          ...quoteForm,
                          risk_factors: {
                            ...quoteForm.risk_factors,
                            previous_claims: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="high-risk-routes"
                        checked={quoteForm.risk_factors.high_risk_routes}
                        onChange={(e) => setQuoteForm({
                          ...quoteForm,
                          risk_factors: {
                            ...quoteForm.risk_factors,
                            high_risk_routes: e.target.checked
                          }
                        })}
                      />
                      <Label htmlFor="high-risk-routes">High Risk Routes</Label>
                    </div>
                  </div>
                  
                  <Button onClick={getInsuranceQuote} className="w-full">
                    Generate Quote
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Insurance Plans */}
          <div className="grid gap-4">
            {insuranceData.plans.map((plan) => (
              <Card key={plan.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">{getInsuranceTypeIcon(plan.insurance_type)}</span>
                        <div>
                          <h4 className="font-semibold">{plan.name}</h4>
                          <p className="text-sm text-gray-600 capitalize">{plan.insurance_type} Insurance</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{plan.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Coverage up to {formatCurrency(plan.coverage_limits?.max || 1000000)}</span>
                        <span>Deductible from {formatCurrency(plan.deductible_options?.[0] || 1000)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600">
                        {formatCurrency(plan.base_premium)}/mo
                      </div>
                      <Button size="sm" className="mt-2">
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {insuranceData.plans.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No insurance plans available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <h3 className="text-lg font-semibold">My Insurance Quotes</h3>
          <div className="grid gap-4">
            {insuranceData.quotes.map((quote) => (
              <Card key={quote.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <Badge className={getStatusBadgeColor(quote.status)}>
                          {quote.status.toUpperCase()}
                        </Badge>
                        <span className="font-medium capitalize">{quote.insurance_type} Insurance</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Coverage: {formatCurrency(quote.coverage_amount)}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        Deductible: {formatCurrency(quote.deductible)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Valid until: {new Date(quote.valid_until).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(quote.premium_amount)}/mo
                      </div>
                      {quote.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="mt-2"
                          onClick={() => purchasePolicy(quote.id)}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Purchase
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {insuranceData.quotes.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No quotes generated yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <h3 className="text-lg font-semibold">My Insurance Policies</h3>
          <div className="grid gap-4">
            {insuranceData.policies.map((policy) => (
              <Card key={policy.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        <span className="font-medium">Policy #{policy.policy_number}</span>
                        <Badge className={getStatusBadgeColor(policy.status)}>
                          {policy.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Coverage: {formatCurrency(policy.coverage_amount)}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        Premium: {formatCurrency(policy.premium_amount)}/month
                      </p>
                      <p className="text-xs text-gray-500">
                        Valid: {new Date(policy.start_date).toLocaleDateString()} - {new Date(policy.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <FileText className="w-4 h-4 mr-1" />
                        Documents
                      </Button>
                      <Button size="sm" variant="outline">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        File Claim
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {insuranceData.policies.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No insurance policies yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Insurance Claims</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  File Claim
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Insurance Claim</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Policy</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={claimForm.policy_id}
                      onChange={(e) => setClaimForm({...claimForm, policy_id: e.target.value})}
                    >
                      <option value="">Select a policy...</option>
                      {insuranceData.policies
                        .filter(p => p.status === 'active')
                        .map(policy => (
                          <option key={policy.id} value={policy.id}>
                            Policy #{policy.policy_number} - {formatCurrency(policy.coverage_amount)}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label>Incident Date</Label>
                    <Input
                      type="date"
                      value={claimForm.incident_date}
                      onChange={(e) => setClaimForm({...claimForm, incident_date: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label>Claim Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={claimForm.claim_amount}
                      onChange={(e) => setClaimForm({...claimForm, claim_amount: e.target.value})}
                      placeholder="5000.00"
                    />
                  </div>
                  
                  <div>
                    <Label>Incident Type</Label>
                    <Select
                      value={claimForm.incident_type}
                      onValueChange={(value) => setClaimForm({...claimForm, incident_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cargo_damage">Cargo Damage</SelectItem>
                        <SelectItem value="vehicle_accident">Vehicle Accident</SelectItem>
                        <SelectItem value="theft">Theft</SelectItem>
                        <SelectItem value="weather_damage">Weather Damage</SelectItem>
                        <SelectItem value="equipment_failure">Equipment Failure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={claimForm.description}
                      onChange={(e) => setClaimForm({...claimForm, description: e.target.value})}
                      placeholder="Describe the incident in detail..."
                      rows={4}
                    />
                  </div>
                  
                  <Button onClick={fileInsuranceClaim} className="w-full">
                    Submit Claim
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {insuranceData.claims.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span className="font-medium">Claim #{claim.claim_number}</span>
                        <Badge className={getStatusBadgeColor(claim.status)}>
                          {claim.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {claim.incident_type.replace('_', ' ')}: {formatCurrency(claim.claim_amount)}
                      </p>
                      <p className="text-sm text-gray-700 mb-1">{claim.description}</p>
                      <p className="text-xs text-gray-500">
                        Filed: {new Date(claim.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {insuranceData.claims.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-center text-gray-500">No claims filed yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InsuranceMarketplace;