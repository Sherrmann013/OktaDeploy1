import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Save, Key, Globe, Shield, Bell } from "lucide-react";

export default function Settings() {
  const [orgName, setOrgName] = useState("Maze Therapeutics");
  const [domain, setDomain] = useState("company.okta.com");
  const [mfaRequired, setMfaRequired] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("8");
  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleSave = () => {
    // In real implementation, this would call OKTA API to update settings
    console.log("Saving settings...");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex text-sm text-gray-500 mb-1">
                <span>Settings</span>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">General</span>
              </nav>
              <h2 className="text-2xl font-semibold text-gray-900">Organization Settings</h2>
            </div>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="authentication">Authentication</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Globe className="w-5 h-5 mr-2" />
                      Organization Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="orgName">Organization Name</Label>
                        <Input
                          id="orgName"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="domain">OKTA Domain</Label>
                        <Input
                          id="domain"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          className="mt-1"
                          disabled
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="subdomain">Subdomain</Label>
                      <Input
                        id="subdomain"
                        value="company"
                        className="mt-1"
                        disabled
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Contact OKTA support to change your subdomain
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select defaultValue="america/los_angeles">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="america/los_angeles">America/Los Angeles (PST)</SelectItem>
                          <SelectItem value="america/new_york">America/New York (EST)</SelectItem>
                          <SelectItem value="america/chicago">America/Chicago (CST)</SelectItem>
                          <SelectItem value="europe/london">Europe/London (GMT)</SelectItem>
                          <SelectItem value="asia/tokyo">Asia/Tokyo (JST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="w-5 h-5 mr-2" />
                      Security Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="mfa-required">Require MFA for all users</Label>
                        <p className="text-sm text-gray-500">
                          Enforce multi-factor authentication for enhanced security
                        </p>
                      </div>
                      <Switch
                        id="mfa-required"
                        checked={mfaRequired}
                        onCheckedChange={setMfaRequired}
                      />
                    </div>

                    <div>
                      <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                      <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                        <SelectTrigger className="mt-1 max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Password Policy</Label>
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Minimum 12 characters</li>
                          <li>• At least one uppercase letter</li>
                          <li>• At least one lowercase letter</li>
                          <li>• At least one number</li>
                          <li>• At least one special character</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="authentication">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Key className="w-5 h-5 mr-2" />
                      Authentication Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>Supported MFA Methods</Label>
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">OKTA Verify</div>
                            <div className="text-sm text-gray-500">Push notifications and TOTP</div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">SMS Authentication</div>
                            <div className="text-sm text-gray-500">Text message verification codes</div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">Security Questions</div>
                            <div className="text-sm text-gray-500">Backup authentication method</div>
                          </div>
                          <Switch />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Sign-On Policy</Label>
                      <Select defaultValue="balanced">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lenient">Lenient - Faster access, lower security</SelectItem>
                          <SelectItem value="balanced">Balanced - Default security settings</SelectItem>
                          <SelectItem value="strict">Strict - Maximum security, slower access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bell className="w-5 h-5 mr-2" />
                      Notification Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="email-notifications">Email Notifications</Label>
                        <p className="text-sm text-gray-500">
                          Receive email alerts for security events and admin activities
                        </p>
                      </div>
                      <Switch
                        id="email-notifications"
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>

                    <div>
                      <Label>Notification Types</Label>
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">Security Events</div>
                            <div className="text-sm text-gray-500">Suspicious logins, failed authentications</div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">User Management</div>
                            <div className="text-sm text-gray-500">User creation, suspension, deletion</div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium">System Updates</div>
                            <div className="text-sm text-gray-500">Maintenance, feature updates</div>
                          </div>
                          <Switch />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="admin-email">Admin Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value="admin@company.com"
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}