import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-8">
          <div className="glass rounded-2xl border border-border-subtle shadow-glow p-8 max-w-md text-center">
            <div className="w-14 h-14 rounded-full bg-wasted/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-wasted" />
            </div>
            <h2 className="text-xl font-bold text-txt-primary mb-2">Something went wrong</h2>
            <p className="text-sm text-txt-secondary mb-1">
              FocusLedger encountered an unexpected error.
            </p>
            <p className="text-xs text-txt-muted mb-6 font-mono bg-void/50 rounded-lg p-3 text-left overflow-auto max-h-[100px]">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <p className="text-xs text-txt-muted mb-6">
              Your tracking data is safe. Click below to restart the interface.
            </p>
            <button
              onClick={this.handleRestart}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90
                         text-white font-medium transition-colors cursor-pointer"
            >
              <RotateCcw size={16} /> Restart Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
