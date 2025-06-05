import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertTriangle, CheckCircle, Users, Smartphone, Key, Activity } from "lucide-react";

interface SecurityMetrics {
  mfaAdoption: number;
  totalUsers: number;
  mfaEnabledUsers: number;
  riskEvents: number;
  suspiciousLogins: number;
  passwordPolicyCompliance: number;
}

interface SecurityEvent {
  id: string;
  type: "SUSPICIOUS_LOGIN" | "MFA_FAILURE" | "PASSWORD_BREACH" | "DEVICE_TRUST";
  user: string;
  timestamp: string;
  location: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "RESOLVED" | "INVESTIGATING";
}

export default function Security() {
  const { data: metrics } = useQuery<SecurityMetrics>({
    queryKey: ["/api/security/metrics"],
    queryFn: async () => ({
      mfaAdoption: 78.5,
      totalUsers: 156,
      mfaEnabledUsers: 122,
      riskEvents: 5,
      suspiciousLogins: 3,
      passwordPolicyCompliance: 94.2
    }),
  });

  const { data: events = [] } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security/events"],
    queryFn: async () => [
      {
        id: "evt_001",
        type: "SUSPICIOUS_LOGIN",
        user: "john.doe@company.com",
        timestamp: "2024-11-28T14:30:00Z",
        location: "Unknown Location (192.168.1.1)",
        riskLevel: "HIGH",
        status: "INVESTIGATING"
      },
      {
        id: "evt_002",
        type: "MFA_FAILURE",
        user: "jane.smith@company.com",
        timestamp: "2024-11-28T13:15:00Z",
        location: "San Francisco, CA",
        riskLevel: "MEDIUM",
        status: "OPEN"
      },
      {
        id: "evt_003",
        type: "PASSWORD_BREACH",
        user: "mike.brown@company.com",
        timestamp: "2024-11-28T10:45:00Z",
        location: "New York, NY",
        riskLevel: "HIGH",
        status: "RESOLVED"
      }
    ],
  });

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "HIGH":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">High Risk</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium Risk</Badge>;
      case "LOW":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Low Risk</Badge>;
      default:
        return <Badge variant="secondary">{level}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Open</Badge>;
      case "INVESTIGATING":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Investigating</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "SUSPICIOUS_LOGIN":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "MFA_FAILURE":
        return <Smartphone className="w-4 h-4 text-yellow-500" />;
      case "PASSWORD_BREACH":
        return <Key className="w-4 h-4 text-red-500" />;
      case "DEVICE_TRUST":
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex text-sm text-gray-500 mb-1">
                <span>Security</span>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">Overview</span>
              </nav>
              <h2 className="text-2xl font-semibold text-gray-900">Security Dashboard</h2>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline">
                Security Report
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Shield className="w-4 h-4 mr-2" />
                Configure Policies
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Security Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">MFA Adoption</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics?.mfaAdoption}%</p>
                    <p className="text-xs text-gray-500">{metrics?.mfaEnabledUsers} of {metrics?.totalUsers} users</p>
                  </div>
                  <Smartphone className="w-8 h-8 text-green-600" />
                </div>
                <Progress value={metrics?.mfaAdoption || 0} className="mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Risk Events</p>
                    <p className="text-2xl font-bold text-red-600">{metrics?.riskEvents}</p>
                    <p className="text-xs text-gray-500">Last 24 hours</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Password Compliance</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics?.passwordPolicyCompliance}%</p>
                    <p className="text-xs text-gray-500">Policy adherence</p>
                  </div>
                  <Key className="w-8 h-8 text-blue-600" />
                </div>
                <Progress value={metrics?.passwordPolicyCompliance || 0} className="mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Suspicious Logins</p>
                    <p className="text-2xl font-bold text-yellow-600">{metrics?.suspiciousLogins}</p>
                    <p className="text-xs text-gray-500">Under investigation</p>
                  </div>
                  <Shield className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Events */}
          <Tabs defaultValue="events" className="space-y-6">
            <TabsList>
              <TabsTrigger value="events">Security Events</TabsTrigger>
              <TabsTrigger value="policies">Security Policies</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Security Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getEventIcon(event.type)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatEventType(event.type)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {event.user} • {event.location}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatTimestamp(event.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getRiskBadge(event.riskLevel)}
                          {getStatusBadge(event.status)}
                          <Button variant="outline" size="sm">
                            Investigate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies">
              <Card>
                <CardHeader>
                  <CardTitle>Security Policies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Password Policy</div>
                        <div className="text-sm text-gray-500">Minimum 12 characters, complexity required</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">MFA Enforcement</div>
                        <div className="text-sm text-gray-500">Required for all admin users</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Session Timeout</div>
                        <div className="text-sm text-gray-500">8 hours of inactivity</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600">Active</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Security Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Security reports and analytics coming soon</p>
                    <Button variant="outline" className="mt-4">
                      Generate Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
}