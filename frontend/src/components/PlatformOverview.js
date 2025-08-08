import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Shield, 
  BookOpen, 
  Truck, 
  Warehouse,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Award,
  Target,
  Clock,
  CheckCircle,
  Star
} from 'lucide-react';

const PlatformOverview = ({ user, token }) => {
  const [overviewData, setOverviewData] = useState({
    totalUsers: 15420,
    activeShipments: 1248,
    completedOrders: 8937,
    totalRevenue: 2847500,
    growthRate: 23.5,
    marketplaces: [
      {
        name: "Freight Marketplace",
        icon: Truck,
        description: "Connect shippers with carriers for efficient freight transportation",
        stats: { active: 89, completed: 456, revenue: 1250000 },
        features: ["Real-time tracking", "Dynamic pricing", "Route optimization", "Instant payments"]
      },
      {
        name: "Equipment Rental",
        icon: Package,
        description: "Rent logistics equipment and machinery",
        stats: { active: 34, completed: 127, revenue: 450000 },
        features: ["24/7 availability", "Flexible terms", "Maintenance included", "Insurance coverage"]
      },
      {
        name: "Warehouse Services",
        icon: Warehouse,
        description: "Find and book warehouse space and services",
        stats: { active: 22, completed: 89, revenue: 380000 },
        features: ["Storage solutions", "Inventory management", "Pick & pack", "Distribution"]
      },
      {
        name: "Insurance Marketplace",
        icon: Shield,
        description: "Comprehensive insurance coverage for logistics operations",
        stats: { active: 67, completed: 234, revenue: 567500 },
        features: ["Cargo insurance", "Fleet coverage", "Liability protection", "Claims processing"]
      },
      {
        name: "Training Hub",
        icon: BookOpen,
        description: "Professional development and certification programs",
        stats: { active: 156, completed: 892, revenue: 200000 },
        features: ["Safety training", "Compliance courses", "Skill development", "Certifications"]
      }
    ]
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">Welcome to TruxCom Platform</h1>
          <p className="text-xl mb-6 opacity-90">
            The complete logistics ecosystem connecting shippers, carriers, and service providers 
            with advanced tracking, secure payments, and professional services.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{formatNumber(overviewData.totalUsers)}</div>
              <div className="text-sm opacity-80">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{formatNumber(overviewData.activeShipments)}</div>
              <div className="text-sm opacity-80">Active Shipments</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{formatNumber(overviewData.completedOrders)}</div>
              <div className="text-sm opacity-80">Completed Orders</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">+{overviewData.growthRate}%</div>
              <div className="text-sm opacity-80">Monthly Growth</div>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overviewData.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              +{overviewData.growthRate}% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">
              Active marketplace usage
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.8/5</div>
            <p className="text-xs text-muted-foreground">
              Average rating across services
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">&lt;2min</div>
            <p className="text-xs text-muted-foreground">
              Average support response
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="marketplaces" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="marketplaces">Marketplace Overview</TabsTrigger>
          <TabsTrigger value="features">Platform Features</TabsTrigger>
          <TabsTrigger value="insights">Business Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="space-y-4">
          <h3 className="text-lg font-semibold">Our Marketplace Ecosystem</h3>
          
          <div className="grid gap-6">
            {overviewData.marketplaces.map((marketplace, index) => {
              const IconComponent = marketplace.icon;
              
              return (
                <Card key={index} className="overflow-hidden">
                  <div className="flex">
                    {/* Icon Section */}
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-8 flex items-center justify-center min-w-[120px]">
                      <IconComponent className="w-12 h-12 text-white" />
                    </div>
                    
                    {/* Content Section */}
                    <div className="flex-1 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-semibold mb-2">{marketplace.name}</h4>
                          <p className="text-gray-600">{marketplace.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-500">Revenue</div>
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(marketplace.stats.revenue)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex space-x-6 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{marketplace.stats.active}</div>
                          <div className="text-xs text-gray-500">Active</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{marketplace.stats.completed}</div>
                          <div className="text-xs text-gray-500">Completed</div>
                        </div>
                      </div>
                      
                      {/* Features */}
                      <div className="flex flex-wrap gap-2">
                        {marketplace.features.map((feature, featureIndex) => (
                          <Badge key={featureIndex} variant="secondary">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <h3 className="text-lg font-semibold">Platform Features & Capabilities</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Advanced Tracking",
                description: "Real-time GPS tracking with geofencing, route optimization, and ETA predictions",
                status: "Active"
              },
              {
                icon: Shield,
                title: "Secure Payments",
                description: "Escrow services, automated invoicing, and multi-currency support",
                status: "Active"
              },
              {
                icon: Award,
                title: "Quality Assurance",
                description: "KYC verification, dispute resolution, and performance monitoring",
                status: "Active"
              },
              {
                icon: TrendingUp,
                title: "Analytics Dashboard",
                description: "AI-powered insights, predictive analytics, and custom reporting",
                status: "Active"
              },
              {
                icon: Users,
                title: "User Management",
                description: "Role-based access, team collaboration, and permission controls",
                status: "Active"
              },
              {
                icon: CheckCircle,
                title: "Compliance Tools",
                description: "Regulatory compliance, safety standards, and audit trails",
                status: "Active"
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon;
              
              return (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        {feature.status}
                      </Badge>
                    </div>
                    
                    <h4 className="font-semibold mb-2">{feature.title}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <h3 className="text-lg font-semibold">Business Insights & Trends</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Market Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Market Performance</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Freight Volume Growth</span>
                    <span className="font-semibold text-green-600">+23%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Acquisition</span>
                    <span className="font-semibold text-green-600">+18%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Revenue per User</span>
                    <span className="font-semibold text-green-600">+15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Platform Efficiency</span>
                    <span className="font-semibold text-blue-600">94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* User Engagement */}
            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Platform activity metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Daily Active Users</span>
                    <span className="font-semibold">8.2K</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Session Duration</span>
                    <span className="font-semibold">24min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Feature Adoption</span>
                    <span className="font-semibold text-green-600">87%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">User Retention</span>
                    <span className="font-semibold text-green-600">92%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Income by service category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Freight Services", percentage: 44, amount: 1250000 },
                    { name: "Insurance", percentage: 20, amount: 567500 },
                    { name: "Equipment Rental", percentage: 16, amount: 450000 },
                    { name: "Warehouse Services", percentage: 13, amount: 380000 },
                    { name: "Training Programs", percentage: 7, amount: 200000 }
                  ].map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Future Projections */}
            <Card>
              <CardHeader>
                <CardTitle>Future Projections</CardTitle>
                <CardDescription>AI-powered forecasting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Next Month Revenue</span>
                    <span className="font-semibold text-green-600">{formatCurrency(3100000)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Expected Growth Rate</span>
                    <span className="font-semibold text-green-600">+26%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New User Registrations</span>
                    <span className="font-semibold">+1.8K</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Market Expansion</span>
                    <span className="font-semibold text-blue-600">3 New Cities</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">AI Insight</span>
                  </div>
                  <p className="text-sm text-blue-800">
                    Based on current trends, the platform is positioned for exceptional growth 
                    with insurance and training services showing the highest potential for expansion.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlatformOverview;