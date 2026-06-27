import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-mono">
          <div className="max-w-3xl w-full bg-red-900/20 border border-red-500/50 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-500 mb-4">React Error</h1>
            <div className="mb-4 text-red-200">
              {this.state.error && this.state.error.toString()}
            </div>
            <div className="bg-black/50 p-4 rounded overflow-auto text-xs whitespace-pre-wrap max-h-[60vh] text-gray-300">
              {this.state.errorInfo?.componentStack || this.state.error?.stack}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
