import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Truck, Users, 
  Calendar, BarChart3, PieChart, Activity, Target, Award 
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AnalyticsDashboard = ({ user, token }) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState({
    revenue: { data: [], total: 0 },
    shipments: { data: [] },
    performance: {},
    trends: {}
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [revenueResponse, shipmentsResponse] = await Promise.all([
        axios.post(`${API}/analytics`, {
          metric: 'revenue',
          time_range: timeRange,
          filters: {}
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.post(`${API}/analytics`, {
          metric: 'shipments',
          time_range: timeRange,
          filters: {}
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setAnalytics({
        revenue: revenueResponse.data,
        shipments: shipmentsResponse.data,
        performance: generatePerformanceData(),
        trends: generateTrendsData()
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePerformanceData = () => {
    // Mock performance data - in real app, this would come from backend
    return {
      efficiency: 87,
      customerSatisfaction: 94,
      onTimeDelivery: 91,
      costOptimization: 78
    };
  };

  const generateTrendsData = () => {
    // Mock trends data
    return {
      revenueGrowth: 12.5,
      shipmentVolume: 8.3,
      customerRetention: 89.2,
      avgShipmentValue: 2847
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getTimeRangeLabel = (range) => {
    const labels = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      '1y': 'Last year'
    };
    return labels[range] || 'Last 30 days';
  };

  const StatCard = ({ title, value, change, icon: Icon, trend }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{value}</p>
          {change !== undefined && (
            <div className="flex items-center space-x-1">
              {trend === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">from last period</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const PerformanceCard = ({ title, value, target, icon: Icon }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-yellow-600" />
            <p className="font-medium">{title}</p>
          </div>
          <Badge variant={value >= target ? 'default' : 'secondary'}>
            {value >= target ? 'On Track' : 'Needs Attention'}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Current: {formatPercentage(value)}</span>
            <span className="text-muted-foreground">Target: {formatPercentage(target)}</span>
          </div>
          <Progress value={value} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Track your business performance and insights</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(analytics.revenue.total)}
              change={analytics.trends.revenueGrowth}
              trend="up"
              icon={DollarSign}
            />
            <StatCard
              title="Shipments"
              value={analytics.shipments.data?.length || 0}
              change={analytics.trends.shipmentVolume}
              trend="up"
              icon={Package}
            />
            <StatCard
              title="Avg. Shipment Value"
              value={formatCurrency(analytics.trends.avgShipmentValue)}
              change={5.2}
              trend="up"
              icon={TrendingUp}
            />
            <StatCard
              title="Customer Retention"
              value={formatPercentage(analytics.trends.customerRetention)}
              change={2.1}
              trend="up"
              icon={Users}
            />
          </div>

          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>{getTimeRangeLabel(timeRange)}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Daily Revenue</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-2">Revenue Chart</p>
                  <p className="text-sm text-gray-500">
                    Interactive revenue chart would be displayed here
                  </p>
                  <p className="text-sm text-gray-500">
                    Total: {formatCurrency(analytics.revenue.total)} over {getTimeRangeLabel(timeRange).toLowerCase()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Status Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Status</CardTitle>
                <CardDescription>Distribution of shipment statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.shipments.data?.map((status) => (
                    <div key={status._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          status._id === 'delivered' ? 'bg-green-500' :
                          status._id === 'in_transit' ? 'bg-blue-500' :
                          status._id === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="capitalize">{status._id.replace('_', ' ')}</span>
                      </div>
                      <Badge variant="outline">{status.count}</Badge>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No shipment data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Response Time</span>
                    <span className="font-medium">2.3 hours</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-medium text-green-600">98.7%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Rating</span>
                    <span className="font-medium">4.8/5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Distance</span>
                    <span className="font-medium">12,847 miles</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <PerformanceCard
              title="Operational Efficiency"
              value={analytics.performance.efficiency}
              target={85}
              icon={Activity}
            />
            <PerformanceCard
              title="Customer Satisfaction"
              value={analytics.performance.customerSatisfaction}
              target={90}
              icon={Award}
            />
            <PerformanceCard
              title="On-Time Delivery"
              value={analytics.performance.onTimeDelivery}
              target={90}
              icon={Target}
            />
            <PerformanceCard
              title="Cost Optimization"
              value={analytics.performance.costOptimization}
              target={80}
              icon={TrendingUp}
            />
          </div>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>Actionable recommendations to improve your metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Excellent Customer Satisfaction</h4>
                      <p className="text-sm text-green-700">
                        Your customer satisfaction score of 94% is above industry average. Keep up the great work!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Cost Optimization Opportunity</h4>
                      <p className="text-sm text-yellow-700">
                        Cost optimization at 78% suggests room for improvement in route planning and fuel efficiency.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Strong Operational Performance</h4>
                      <p className="text-sm text-blue-700">
                        87% operational efficiency indicates solid business processes with minor optimization potential.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-600">Revenue Growth</p>
                </div>
                <p className="text-2xl font-bold mt-2">+{formatPercentage(analytics.trends.revenueGrowth)}</p>
                <p className="text-xs text-muted-foreground">vs. last period</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-600">Shipment Volume</p>
                </div>
                <p className="text-2xl font-bold mt-2">+{formatPercentage(analytics.trends.shipmentVolume)}</p>
                <p className="text-xs text-muted-foreground">vs. last period</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-medium text-purple-600">Customer Retention</p>
                </div>
                <p className="text-2xl font-bold mt-2">{formatPercentage(analytics.trends.customerRetention)}</p>
                <p className="text-xs text-muted-foreground">current rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-600">Avg. Order Value</p>
                </div>
                <p className="text-2xl font-bold mt-2">{formatCurrency(analytics.trends.avgShipmentValue)}</p>
                <p className="text-xs text-muted-foreground">per shipment</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>Business trends over {getTimeRangeLabel(timeRange).toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-2">Trend Analysis Chart</p>
                  <p className="text-sm text-gray-500">
                    Interactive trend charts would be displayed here showing:
                  </p>
                  <ul className="text-sm text-gray-500 mt-2 space-y-1">
                    <li>• Revenue growth patterns</li>
                    <li>• Seasonal variations</li>
                    <li>• Customer behavior trends</li>
                    <li>• Market opportunity analysis</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Insights</CardTitle>
                <CardDescription>Intelligent recommendations based on your data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Revenue Optimization</h4>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Peak demand occurs on Tuesdays and Wednesdays. Consider dynamic pricing to maximize revenue.
                        </p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Long-distance shipments (>500 miles) show 23% higher profit margins. Focus marketing on these routes.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Operational Efficiency</h4>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Route optimization could reduce fuel costs by an estimated 12-15% based on current patterns.
                        </p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Partnering with more carriers in the Midwest region could improve delivery times by 18%.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Customer Experience</h4>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Customers who receive real-time updates are 34% more likely to book again within 30 days.
                        </p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-600">
                          Average response time under 2 hours correlates with 89% customer satisfaction scores.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>Prioritized recommendations to improve your business</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-red-100 text-red-800">High Priority</Badge>
                      <span className="text-sm text-gray-500">Est. Impact: +15% revenue</span>
                    </div>
                    <h4 className="font-medium">Implement Dynamic Pricing</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Adjust pricing based on demand patterns, route difficulty, and market conditions.
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>
                      <span className="text-sm text-gray-500">Est. Impact: +8% efficiency</span>
                    </div>
                    <h4 className="font-medium">Optimize Route Planning</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Implement AI-powered route optimization to reduce fuel costs and improve delivery times.
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-green-100 text-green-800">Low Priority</Badge>
                      <span className="text-sm text-gray-500">Est. Impact: +5% satisfaction</span>
                    </div>
                    <h4 className="font-medium">Expand Notification Channels</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Add SMS and push notifications for better customer communication.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;