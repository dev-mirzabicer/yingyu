"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Bell,
  Globe,
  Shield,
  Download,
  Upload,
  Save,
  RotateCcw,
  AlertTriangle,
  User,
  Mail,
  Phone,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTeacherSettings, updateTeacherSettings } from "@/hooks/use-api-enhanced"

interface TeacherSettingsPanelProps {
  teacherId: string
}

interface SettingsFormData {
  // Profile Settings
  name: string
  email: string
  phone: string
  timezone: string
  avatarUrl: string

  // Teaching Preferences
  paymentAlertThreshold: number
  preferredLessonDuration: number
  defaultNewCardsPerDay: number
  defaultReviewLimit: number
  autoScheduleBreaks: boolean
  sendReminders: boolean

  // Notification Settings
  emailNotifications: boolean
  smsNotifications: boolean
  paymentAlerts: boolean
  sessionReminders: boolean
  studentProgressAlerts: boolean

  // System Preferences
  language: string
  dateFormat: string
  timeFormat: string
  currency: string
  theme: string

  // Privacy & Security
  profileVisibility: string
  dataRetention: number
  twoFactorAuth: boolean
  sessionLogging: boolean
}

const timezones = [
  { value: "Asia/Shanghai", label: "China Standard Time (UTC+8)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (UTC+9)" },
  { value: "Asia/Seoul", label: "Korea Standard Time (UTC+9)" },
  { value: "America/New_York", label: "Eastern Time (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC-8/-7)" },
  { value: "Europe/London", label: "Greenwich Mean Time (UTC+0/+1)" },
  { value: "Europe/Paris", label: "Central European Time (UTC+1/+2)" },
]

const languages = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
]

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

const currencies = [
  { value: "USD", label: "US Dollar ($)" },
  { value: "CNY", label: "Chinese Yuan (¥)" },
  { value: "JPY", label: "Japanese Yen (¥)" },
  { value: "KRW", label: "Korean Won (₩)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
]

export function TeacherSettingsPanel({ teacherId }: TeacherSettingsPanelProps) {
  const { settings, isLoading, isError, mutate } = useTeacherSettings()
  const [formData, setFormData] = useState<SettingsFormData>({
    // Profile Settings
    name: "",
    email: "",
    phone: "",
    timezone: "Asia/Shanghai",
    avatarUrl: "",

    // Teaching Preferences
    paymentAlertThreshold: 3,
    preferredLessonDuration: 60,
    defaultNewCardsPerDay: 10,
    defaultReviewLimit: 50,
    autoScheduleBreaks: true,
    sendReminders: true,

    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    paymentAlerts: true,
    sessionReminders: true,
    studentProgressAlerts: true,

    // System Preferences
    language: "en",
    dateFormat: "MM/dd/yyyy",
    timeFormat: "12h",
    currency: "USD",
    theme: "light",

    // Privacy & Security
    profileVisibility: "private",
    dataRetention: 365,
    twoFactorAuth: false,
    sessionLogging: true,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const { toast } = useToast()

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        paymentAlertThreshold: settings.paymentAlertThreshold,
        preferredLessonDuration: settings.preferredLessonDuration,
      }))
    }
  }, [settings])

  const handleInputChange = (field: keyof SettingsFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  const handleSaveSettings = async () => {
    setIsSubmitting(true)
    try {
      await updateTeacherSettings({
        paymentAlertThreshold: formData.paymentAlertThreshold,
        preferredLessonDuration: formData.preferredLessonDuration,
      })

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      })

      setHasUnsavedChanges(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetSettings = () => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        paymentAlertThreshold: settings.paymentAlertThreshold,
        preferredLessonDuration: settings.preferredLessonDuration,
      }))
      setHasUnsavedChanges(false)
    }
  }

  const handleExportSettings = () => {
    const settingsData = JSON.stringify(formData, null, 2)
    const blob = new Blob([settingsData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "teacher-settings.json"
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Settings exported",
      description: "Your settings have been downloaded as a JSON file.",
    })
  }

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string)
        setFormData((prev) => ({ ...prev, ...importedSettings }))
        setHasUnsavedChanges(true)
        toast({
          title: "Settings imported",
          description: "Settings have been loaded from file. Don't forget to save!",
        })
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Invalid settings file format.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load teacher settings. Please try again.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Teacher Settings</h2>
          <p className="text-slate-600">Manage your preferences and account settings</p>
        </div>
        <div className="flex items-center space-x-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleExportSettings}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </span>
            </Button>
            <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
          </label>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="teaching">Teaching</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="your.email@example.com"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={formData.timezone} onValueChange={(value) => handleInputChange("timezone", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL (Optional)</Label>
                <Input
                  id="avatarUrl"
                  value={formData.avatarUrl}
                  onChange={(e) => handleInputChange("avatarUrl", e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teaching Preferences */}
        <TabsContent value="teaching">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Teaching Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="paymentAlert">Payment Alert Threshold</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="paymentAlert"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.paymentAlertThreshold}
                      onChange={(e) => handleInputChange("paymentAlertThreshold", Number.parseInt(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-slate-600">classes remaining</span>
                  </div>
                  <p className="text-xs text-slate-500">Get notified when students have this many classes left</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lessonDuration">Preferred Lesson Duration</Label>
                  <Select
                    value={formData.preferredLessonDuration.toString()}
                    onValueChange={(value) => handleInputChange("preferredLessonDuration", Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newCards">Default New Cards Per Day</Label>
                  <Input
                    id="newCards"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.defaultNewCardsPerDay}
                    onChange={(e) => handleInputChange("defaultNewCardsPerDay", Number.parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reviewLimit">Default Review Limit</Label>
                  <Input
                    id="reviewLimit"
                    type="number"
                    min="10"
                    max="200"
                    value={formData.defaultReviewLimit}
                    onChange={(e) => handleInputChange("defaultReviewLimit", Number.parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Auto-schedule Breaks</Label>
                    <p className="text-sm text-slate-500">Automatically add breaks between back-to-back lessons</p>
                  </div>
                  <Switch
                    checked={formData.autoScheduleBreaks}
                    onCheckedChange={(checked) => handleInputChange("autoScheduleBreaks", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Send Reminders</Label>
                    <p className="text-sm text-slate-500">Send automatic reminders to students before lessons</p>
                  </div>
                  <Switch
                    checked={formData.sendReminders}
                    onCheckedChange={(checked) => handleInputChange("sendReminders", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-slate-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={formData.emailNotifications}
                    onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-slate-500">Receive notifications via text message</p>
                  </div>
                  <Switch
                    checked={formData.smsNotifications}
                    onCheckedChange={(checked) => handleInputChange("smsNotifications", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Payment Alerts</Label>
                    <p className="text-sm text-slate-500">Get notified when students need to make payments</p>
                  </div>
                  <Switch
                    checked={formData.paymentAlerts}
                    onCheckedChange={(checked) => handleInputChange("paymentAlerts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Session Reminders</Label>
                    <p className="text-sm text-slate-500">Reminders for upcoming teaching sessions</p>
                  </div>
                  <Switch
                    checked={formData.sessionReminders}
                    onCheckedChange={(checked) => handleInputChange("sessionReminders", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Student Progress Alerts</Label>
                    <p className="text-sm text-slate-500">Notifications about student milestones and achievements</p>
                  </div>
                  <Switch
                    checked={formData.studentProgressAlerts}
                    onCheckedChange={(checked) => handleInputChange("studentProgressAlerts", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Preferences */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>System Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={formData.language} onValueChange={(value) => handleInputChange("language", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(value) => handleInputChange("currency", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={formData.dateFormat} onValueChange={(value) => handleInputChange("dateFormat", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select value={formData.timeFormat} onValueChange={(value) => handleInputChange("timeFormat", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24 Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={formData.theme} onValueChange={(value) => handleInputChange("theme", value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-slate-500">Add an extra layer of security to your account</p>
                  </div>
                  <Switch
                    checked={formData.twoFactorAuth}
                    onCheckedChange={(checked) => handleInputChange("twoFactorAuth", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Session Logging</Label>
                    <p className="text-sm text-slate-500">Keep detailed logs of teaching sessions for analysis</p>
                  </div>
                  <Switch
                    checked={formData.sessionLogging}
                    onCheckedChange={(checked) => handleInputChange("sessionLogging", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="profileVisibility">Profile Visibility</Label>
                  <Select
                    value={formData.profileVisibility}
                    onValueChange={(value) => handleInputChange("profileVisibility", value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="students">Students Only</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataRetention">Data Retention (Days)</Label>
                  <Input
                    id="dataRetention"
                    type="number"
                    min="30"
                    max="3650"
                    value={formData.dataRetention}
                    onChange={(e) => handleInputChange("dataRetention", Number.parseInt(e.target.value))}
                    className="w-32"
                  />
                  <p className="text-xs text-slate-500">How long to keep student data and session records</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save/Reset Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={handleResetSettings} disabled={!hasUnsavedChanges || isSubmitting}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Changes
        </Button>

        <Button
          onClick={handleSaveSettings}
          disabled={!hasUnsavedChanges || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
