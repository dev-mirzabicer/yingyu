"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Download,
  Upload,
  Volume2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  AudioWaveformIcon as Waveform,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AudioRecordingIntegrationProps {
  studentId?: string
  cardId?: string
  onRecordingComplete?: (audioBlob: Blob, analysis: AudioAnalysis) => void
}

interface AudioAnalysis {
  duration: number
  quality: "excellent" | "good" | "fair" | "poor"
  clarity: number
  pronunciation: number
  confidence: number
  suggestions: string[]
}

interface RecordingSession {
  id: string
  timestamp: Date
  duration: number
  audioBlob: Blob
  analysis: AudioAnalysis
}

export function AudioRecordingIntegration({ studentId, cardId, onRecordingComplete }: AudioRecordingIntegrationProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null)
  const [volume, setVolume] = useState([80])
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [recordingSessions, setRecordingSessions] = useState<RecordingSession[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const { toast } = useToast()

  // Request microphone permission on component mount
  useEffect(() => {
    checkMicrophonePermission()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setIsPermissionGranted(true)
      stream.getTracks().forEach((track) => track.stop()) // Stop the test stream
    } catch (error) {
      setIsPermissionGranted(false)
      toast({
        title: "Microphone access required",
        description: "Please allow microphone access to use voice recording features.",
        variant: "destructive",
      })
    }
  }

  const startRecording = async () => {
    if (!isPermissionGranted) {
      await checkMicrophonePermission()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        analyzeAudio(blob)
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone.",
      })
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      toast({
        title: "Recording stopped",
        description: "Analyzing your pronunciation...",
      })
    }
  }

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const analyzeAudio = async (blob: Blob) => {
    setIsAnalyzing(true)

    // Simulate audio analysis - in production this would call an AI service
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const mockAnalysis: AudioAnalysis = {
      duration: recordingTime,
      quality: recordingTime > 3 ? "good" : "fair",
      clarity: Math.random() * 30 + 70, // 70-100
      pronunciation: Math.random() * 25 + 75, // 75-100
      confidence: Math.random() * 20 + 80, // 80-100
      suggestions: [
        "Try speaking more slowly for better clarity",
        "Focus on consonant sounds at word endings",
        "Great intonation! Keep it up",
      ].slice(0, Math.floor(Math.random() * 3) + 1),
    }

    setAnalysis(mockAnalysis)
    setIsAnalyzing(false)

    // Create recording session
    const session: RecordingSession = {
      id: Date.now().toString(),
      timestamp: new Date(),
      duration: recordingTime,
      audioBlob: blob,
      analysis: mockAnalysis,
    }

    setRecordingSessions((prev) => [session, ...prev.slice(0, 4)]) // Keep last 5 sessions

    onRecordingComplete?.(blob, mockAnalysis)

    toast({
      title: "Analysis complete",
      description: `Quality: ${mockAnalysis.quality} • Clarity: ${Math.round(mockAnalysis.clarity)}%`,
    })
  }

  const downloadRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `recording-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const resetRecording = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setAnalysis(null)
    setRecordingTime(0)
    setIsPlaying(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent":
        return "text-green-600 bg-green-100"
      case "good":
        return "text-blue-600 bg-blue-100"
      case "fair":
        return "text-yellow-600 bg-yellow-100"
      case "poor":
        return "text-red-600 bg-red-100"
      default:
        return "text-slate-600 bg-slate-100"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Voice Recording Studio</h2>
          <p className="text-slate-600">Practice pronunciation with AI-powered feedback</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isPermissionGranted ? "default" : "destructive"}>
            {isPermissionGranted ? "Microphone Ready" : "Permission Required"}
          </Badge>
        </div>
      </div>

      {/* Permission Alert */}
      {!isPermissionGranted && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Microphone access is required for voice recording. Please allow access and refresh the page.
            <Button variant="outline" size="sm" className="ml-2 bg-transparent" onClick={checkMicrophonePermission}>
              Grant Permission
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="record" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6">
          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="h-5 w-5" />
                <span>Voice Recorder</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recording Status */}
              <div className="text-center space-y-4">
                <div
                  className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${isRecording ? "bg-red-100 animate-pulse" : "bg-slate-100"
                    }`}
                >
                  {isRecording ? (
                    <MicOff className="h-8 w-8 text-red-600" />
                  ) : (
                    <Mic className="h-8 w-8 text-slate-600" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-3xl font-bold text-slate-900">{formatTime(recordingTime)}</div>
                  <div className="text-sm text-slate-500">
                    {isRecording ? "Recording in progress..." : "Ready to record"}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center space-x-4">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    disabled={!isPermissionGranted}
                    className="bg-red-600 hover:bg-red-700"
                    size="lg"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="outline" size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </Button>
                )}

                {audioUrl && (
                  <>
                    <Button onClick={playRecording} variant="outline" size="lg">
                      {isPlaying ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>

                    <Button onClick={resetRecording} variant="outline" size="lg">
                      <RotateCcw className="h-5 w-5 mr-2" />
                      Reset
                    </Button>
                  </>
                )}
              </div>

              {/* Volume Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center space-x-2">
                    <Volume2 className="h-4 w-4" />
                    <span>Playback Volume</span>
                  </Label>
                  <span className="text-sm text-slate-500">{volume[0]}%</span>
                </div>
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-full" />
              </div>

              {/* Audio Element */}
              {audioUrl && (
                <audio
                  ref={(el) => {
                    if (el) {
                      el.volume = volume[0] / 100;
                      audioRef.current = el;
                    }
                  }}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {audioBlob && (
            <Card>
              <CardHeader>
                <CardTitle>Recording Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Button onClick={downloadRecording} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" disabled>
                    <Upload className="h-4 w-4 mr-2" />
                    Share with Teacher
                  </Button>
                  <Button variant="outline" disabled>
                    <Waveform className="h-4 w-4 mr-2" />
                    View Waveform
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {isAnalyzing ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Analyzing Your Pronunciation</h3>
                <p className="text-slate-500">This may take a few moments...</p>
              </CardContent>
            </Card>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Overall Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span>Pronunciation Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Overall Quality</span>
                    <Badge className={getQualityColor(analysis.quality)}>
                      {analysis.quality.charAt(0).toUpperCase() + analysis.quality.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Clarity</span>
                        <span className="text-sm font-medium">{Math.round(analysis.clarity)}%</span>
                      </div>
                      <Progress value={analysis.clarity} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Pronunciation</span>
                        <span className="text-sm font-medium">{Math.round(analysis.pronunciation)}%</span>
                      </div>
                      <Progress value={analysis.pronunciation} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Confidence</span>
                        <span className="text-sm font-medium">{Math.round(analysis.confidence)}%</span>
                      </div>
                      <Progress value={analysis.confidence} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              <Card>
                <CardHeader>
                  <CardTitle>Improvement Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="p-1 bg-blue-100 rounded-full mt-0.5">
                          <CheckCircle className="h-3 w-3 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-700">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Mic className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Analysis Available</h3>
                <p className="text-slate-500">Record your voice to get pronunciation feedback</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recording History</CardTitle>
            </CardHeader>
            <CardContent>
              {recordingSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Mic className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Recordings Yet</h3>
                  <p className="text-slate-500">Your recording history will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recordingSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Mic className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Recording {formatTime(session.duration)}</div>
                          <div className="text-sm text-slate-500">
                            {session.timestamp.toLocaleDateString()} at {session.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getQualityColor(session.analysis.quality)}>{session.analysis.quality}</Badge>
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
