import { Component, type ReactNode } from 'react'

interface SceneBoundaryProps {
  children: ReactNode
  // Shown instead of the 3D scene if it fails (for example, no WebGL on this computer).
  fallback?: ReactNode
  onError?: () => void
}

// Catches a 3D scene that cannot start, so the game keeps working without it.
export class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
