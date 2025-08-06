import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Monitor, Ticket, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useQuery } from "@tanstack/react-query";

interface DashboardCard {
  id: number;
  name: string;
  type: 'knowbe4' | 'sentinel' | 'device_management' | 'service_desk';
  enabled: boolean;
  position: number;
}

export function DashboardContent() {
  // Fetch dashboard cards from the database
  const { data: dashboardCards } = useQuery({
    queryKey: ["/api/dashboard-cards"],
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
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Addigy (Mac)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={addigyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
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
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    Compliant
                  </span>
                  <span>7</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                    Non-Compliant
                  </span>
                  <span>0</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Intune (Windows)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={intuneData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
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
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    Compliant
                  </span>
                  <span>11</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                    Non-Compliant
                  </span>
                  <span>2</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <div className="w-px h-full bg-gray-200 dark:bg-gray-700 mx-auto"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderServiceDeskCard = () => (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-green-600" />
          <CardTitle className="text-green-700 dark:text-green-300">Service Desk (Jira)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Open Tickets</p>
            <p className="text-2xl font-bold text-orange-600">3</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Resolved Today</p>
            <p className="text-2xl font-bold text-green-600">5</p>
          </div>
        </div>
        
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Ticket Priority</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                High
              </span>
              <span>1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                Medium
              </span>
              <span>1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Low
              </span>
              <span>1</span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button size="sm" variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render cards based on database configuration
  const renderCard = (cardData: DashboardCard) => {
    if (!cardData.enabled) return null;

    switch (cardData.type) {
      case 'knowbe4':
        return renderKnowBe4Card();
      case 'sentinel':
        return renderSentinelOneCard();
      case 'device_management':
        return renderDeviceManagementCard();
      case 'service_desk':
        return renderServiceDeskCard();
      default:
        return null;
    }
  };

  // Sort cards by position and filter enabled ones
  const sortedCards = dashboardCards
    ?.filter((card: DashboardCard) => card.enabled)
    ?.sort((a: DashboardCard, b: DashboardCard) => a.position - b.position) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {sortedCards.map((card: DashboardCard) => (
        <div key={card.id}>
          {renderCard(card)}
        </div>
      ))}
    </div>
  );
}