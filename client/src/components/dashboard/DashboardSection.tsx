import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Monitor, Ticket, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function DashboardSection() {
  const [location] = useLocation();
  
  // Detect if we're in a client context
  const currentClientId = location.startsWith('/client/') ? location.split('/')[2] : null;
  
  // Build the appropriate API endpoint
  const dashboardCardsEndpoint = currentClientId 
    ? `/api/client/${currentClientId}/dashboard-cards`
    : `/api/dashboard-cards`;
    
  // Fetch dashboard cards from the database
  const { data: dashboardCards = [] } = useQuery({
    queryKey: [dashboardCardsEndpoint],
    staleTime: 10 * 60 * 1000, // 10 minutes - dashboard layout rarely changes
    refetchOnWindowFocus: false,
  });

  // KnowBe4 campaign data
  const knowBe4Data = [
    { name: 'Completed', value: 75, color: '#22c55e' },
    { name: 'Remaining', value: 25, color: '#e5e7eb' }
  ];

  // SentinelOne agent status data
  const sentinelData = [
    { name: 'Active', value: 18, color: '#22c55e' },
    { name: 'Offline', value: 1, color: '#ef4444' },
    { name: 'Out of Date', value: 1, color: '#f59e0b' }
  ];

  // Device Management - Addigy data
  const addigyData = [
    { name: 'Compliant', value: 7, color: '#22c55e' },
    { name: 'Non-Compliant', value: 0, color: '#ef4444' }
  ];

  // Device Management - Intune data
  const intuneData = [
    { name: 'Compliant', value: 11, color: '#22c55e' },
    { name: 'Non-Compliant', value: 2, color: '#ef4444' }
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow">
          <p className="text-sm">{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  // Card component definitions
  const renderKnowBe4Card = () => (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-blue-700 dark:text-blue-300">KnowBe4 Security Training</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
            <p className="text-2xl font-bold text-blue-600">1</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
            <p className="text-2xl font-bold text-green-600">75%</p>
          </div>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={knowBe4Data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
              >
                {knowBe4Data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="text-center">
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Campaign Active
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderSentinelOneCard = () => (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-purple-600" />
          <CardTitle className="text-purple-700 dark:text-purple-300">SentinelOne</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Threats Detected</p>
            <p className="text-2xl font-bold text-green-600">0</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Agents</p>
            <p className="text-2xl font-bold text-blue-600">20</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Agent Status</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentinelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={80}
                  paddingAngle={0}
                  dataKey="value"
                >
                  {sentinelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            Active: 18
          </span>
          <span className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
            Offline: 1
          </span>
          <span className="flex items-center">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
            Out of Date: 1
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const renderDeviceManagementCard = () => (
    <Card className="border-2 border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Monitor className="w-5 h-5 text-orange-600" />
          <CardTitle className="text-orange-700 dark:text-orange-300">Device Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 relative">
          {/* Addigy Section */}
          <div>
            <h4 className="font-medium text-orange-600 mb-3">Addigy</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devices</p>
                <p className="text-lg font-bold text-green-600">7/7</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance</p>
                <p className="text-lg font-bold text-green-600">100%</p>
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={addigyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={50}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {addigyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600 dark:bg-gray-400 transform -translate-x-1/2 z-10"></div>

          {/* Intune Section */}
          <div>
            <h4 className="font-medium text-blue-600 mb-3">Intune</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devices</p>
                <p className="text-lg font-bold text-orange-600">11/13</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance</p>
                <p className="text-lg font-bold text-orange-600">85%</p>
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={intuneData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={50}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {intuneData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderJiraCard = () => (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-blue-700 dark:text-blue-300">Jira Service Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Open Issues</p>
            <p className="text-2xl font-bold text-blue-600">7</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Escalated Issues</p>
            <p className="text-2xl font-bold text-green-600">0</p>
          </div>
        </div>
        
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-300">SLA Violations</span>
            <span className="text-lg font-bold text-red-400 ml-auto">1</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Card renderer mapping
  const cardComponents = {
    knowbe4: renderKnowBe4Card,
    sentinelone: renderSentinelOneCard,
    device_management: renderDeviceManagementCard,
    jira: renderJiraCard,
  };

  if (!dashboardCards) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Loading state */}
          <div className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 h-48 rounded-lg"></div>
          </div>
          <div className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 h-48 rounded-lg"></div>
          </div>
          <div className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 h-48 rounded-lg"></div>
          </div>
          <div className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 h-48 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  // Sort cards by position
  const sortedCards = [...dashboardCards].sort((a, b) => a.position - b.position);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedCards.map((card) => {
          const Component = cardComponents[card.type as keyof typeof cardComponents];
          return Component ? <div key={card.id}>{Component()}</div> : null;
        })}
      </div>
    </div>
  );
}