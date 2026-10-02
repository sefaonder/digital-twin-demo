import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SCADA ErrorBoundary] Caught exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-slate-100 flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-white border border-slate-300 rounded-lg shadow-xl p-6 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 font-mono tracking-wide uppercase">
                  Station Critical Exception
                </h2>
                <p className="text-xs text-slate-500">
                  Digital Twin runtime intercepted an unhandled error
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3 bg-slate-900 text-slate-200 rounded border border-slate-800 text-xs font-mono overflow-x-auto max-h-36">
              <p className="text-rose-400 font-bold mb-1">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown error occurred'}
              </p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-400 opacity-80 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Component
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Station
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
