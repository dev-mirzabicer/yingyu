"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "../ui/alert"

interface ExerciseErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ExerciseErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ExerciseErrorBoundary extends React.Component<
  ExerciseErrorBoundaryProps,
  ExerciseErrorBoundaryState
> {
  constructor(props: ExerciseErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ExerciseErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Exercise Error Boundary caught an error:', error, errorInfo)
    }

    // In production, you might want to send this to an error reporting service
    // logErrorToService(error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <section role="main" aria-label="Exercise error">
          <Card className="text-center border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center justify-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                <CardTitle className="text-xl font-medium text-red-800">
                  Something went wrong
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-100" role="alert">
                <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                <AlertDescription className="text-red-700">
                  The exercise encountered an unexpected error and couldn't continue.
                  {this.state.error?.message && (
                    <span className="block mt-2 text-sm font-mono bg-red-200 p-2 rounded">
                      {this.state.error.message}
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Button
                  onClick={this.resetError}
                  className="w-full bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-describedby="retry-help"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Try Again
                </Button>
                <div id="retry-help" className="sr-only">
                  Click to reset the exercise and try again
                </div>

                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                >
                  Refresh Page
                </Button>
              </div>

              <div className="text-sm text-red-600 space-y-1">
                <p>If this problem persists:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Try refreshing the page</li>
                  <li>Check your internet connection</li>
                  <li>Contact support if the issue continues</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      )
    }

    return this.props.children
  }
}