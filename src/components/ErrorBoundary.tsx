import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleClearAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F0F4FA] dark:bg-[#0c0f17] flex items-center justify-center p-4 font-sans text-stone-800 dark:text-stone-100"
        >
          <div className="clay-card max-w-md w-full bg-white dark:bg-[#181d27] p-6 rounded-3xl border border-[#E1E1E1] dark:border-stone-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F76B1C]/15 border border-[#F76B1C]/30 text-[#F76B1C] flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-[#1d2d4c] dark:text-white">
              مشکلی در اجرای صفحه پیش آمد
            </h2>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              نگران نباشید؛ داده‌های گالری‌ها امن هستند. با زدن دکمه زیر صفحه را دوباره بارگذاری کنید.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="clay-button clay-orange text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>بارگذاری مجدد برنامه</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReset}
                className="clay-button clay-base text-stone-700 dark:text-stone-300 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
              >
                <span>تنظیم مجدد حافظه موقت</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
