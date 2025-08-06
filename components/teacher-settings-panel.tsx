"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Globe,
  Save,
  RotateCcw,
  AlertTriangle,
  Database,
  Monitor,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTeacherSettings, updateTeacherSettings } from "@/hooks/use-api-enhanced"
import {
  loadUIPreferences,
  saveUIPreferences,
  UI_PREFERENCE_OPTIONS,
  type UIPreferences,
} from "@/lib/ui-preferences"

interface TeacherSettingsPanelProps {
  teacherId: string
}

interface BackendSettingsData {
  paymentAlertThreshold: number
  preferredLessonDuration: number
}

export function TeacherSettingsPanel({ teacherId }: TeacherSettingsPanelProps) {
  const { settings, isLoading, isError, mutate } = useTeacherSettings()
  
  // Backend settings state
  const [backendSettings, setBackendSettings] = useState<BackendSettingsData>({
    paymentAlertThreshold: 3,
    preferredLessonDuration: 60,
  })
  
  // UI preferences state
  const [uiPreferences, setUIPreferences] = useState<UIPreferences>(loadUIPreferences())
  
  const [isSubmittingBackend, setIsSubmittingBackend] = useState(false)
  const [hasUnsavedBackendChanges, setHasUnsavedBackendChanges] = useState(false)
  const [hasUnsavedUIChanges, setHasUnsavedUIChanges] = useState(false)

  const { toast } = useToast()

  // Initialize backend settings when data loads
  useEffect(() => {
    if (settings) {
      setBackendSettings({
        paymentAlertThreshold: settings.paymentAlertThreshold,
        preferredLessonDuration: settings.preferredLessonDuration,
      })
    }
  }, [settings])

  const handleBackendSettingChange = (field: keyof BackendSettingsData, value: number) => {
    setBackendSettings((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedBackendChanges(true)
  }

  const handleUIPreferenceChange = (field: keyof UIPreferences, value: string) => {
    setUIPreferences((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedUIChanges(true)
  }

  const handleSaveBackendSettings = async () => {
    setIsSubmittingBackend(true)
    try {
      await updateTeacherSettings(backendSettings)

      toast({
        title: "Account settings saved",
        description: "Your account preferences have been updated successfully.",
      })

      setHasUnsavedBackendChanges(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save account settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingBackend(false)
    }
  }

  const handleSaveUIPreferences = () => {
    try {
      saveUIPreferences(uiPreferences)
      setHasUnsavedUIChanges(false)
      
      toast({
        title: "Browser preferences saved",
        description: "Your UI preferences have been saved to this browser.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save browser preferences. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleResetBackendSettings = () => {
    if (settings) {
      setBackendSettings({
        paymentAlertThreshold: settings.paymentAlertThreshold,
        preferredLessonDuration: settings.preferredLessonDuration,
      })
      setHasUnsavedBackendChanges(false)
    }
  }

  const handleResetUIPreferences = () => {
    const defaultPrefs = loadUIPreferences()
    setUIPreferences(defaultPrefs)
    setHasUnsavedUIChanges(false)
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
          <p className="text-slate-600">Manage your account preferences and browser settings</p>
        </div>
        <div className="flex items-center space-x-2">
          {(hasUnsavedBackendChanges || hasUnsavedUIChanges) && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
        </div>
      </div>

      {/* Account Settings (Backend Synced) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Account Settings</span>
            <Badge variant="secondary" className="text-xs">
              Synced to Account
            </Badge>
          </CardTitle>
          <p className="text-sm text-slate-600">
            These settings are saved to your account and sync across all devices
          </p>
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
                  value={backendSettings.paymentAlertThreshold}
                  onChange={(e) => handleBackendSettingChange("paymentAlertThreshold", Number.parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-slate-600">classes remaining</span>
              </div>
              <p className="text-xs text-slate-500">Get notified when students have this many classes left</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lessonDuration">Preferred Lesson Duration</Label>
              <Select
                value={backendSettings.preferredLessonDuration.toString()}
                onValueChange={(value) => handleBackendSettingChange("preferredLessonDuration", Number.parseInt(value))}
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
              <p className="text-xs text-slate-500">Default duration for new lesson sessions</p>
            </div>
          </div>

          {/* Account Settings Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleResetBackendSettings} 
              disabled={!hasUnsavedBackendChanges || isSubmittingBackend}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Account Settings
            </Button>

            <Button
              onClick={handleSaveBackendSettings}
              disabled={!hasUnsavedBackendChanges || isSubmittingBackend}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmittingBackend ? "Saving..." : "Save Account Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Browser Preferences (Local Storage) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>Browser Preferences</span>
            <Badge variant="outline" className="text-xs">
              This Browser Only
            </Badge>
          </CardTitle>
          <p className="text-sm text-slate-600">
            These preferences are saved locally to this browser and affect how the app displays information
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Display</Label>
              <Select 
                value={uiPreferences.currency} 
                onValueChange={(value) => handleUIPreferenceChange("currency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_PREFERENCE_OPTIONS.currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">How monetary amounts are displayed throughout the app</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select 
                value={uiPreferences.dateFormat} 
                onValueChange={(value) => handleUIPreferenceChange("dateFormat", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_PREFERENCE_OPTIONS.dateFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">How dates are displayed throughout the app</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeFormat">Time Format</Label>
              <Select 
                value={uiPreferences.timeFormat} 
                onValueChange={(value) => handleUIPreferenceChange("timeFormat", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_PREFERENCE_OPTIONS.timeFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">How times are displayed throughout the app</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select 
                value={uiPreferences.theme} 
                onValueChange={(value) => handleUIPreferenceChange("theme", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_PREFERENCE_OPTIONS.themes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Visual appearance of the application</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Interface Language</Label>
              <Select 
                value={uiPreferences.language} 
                onValueChange={(value) => handleUIPreferenceChange("language", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_PREFERENCE_OPTIONS.languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Language for the user interface (feature coming soon)</p>
            </div>
          </div>

          {/* Browser Preferences Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleResetUIPreferences} 
              disabled={!hasUnsavedUIChanges}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Browser Preferences
            </Button>

            <Button
              onClick={handleSaveUIPreferences}
              disabled={!hasUnsavedUIChanges}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Browser Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
