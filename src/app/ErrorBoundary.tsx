import { Component, type ErrorInfo, type ReactNode } from 'react';
import { brand } from '../brand/brand';
import { t } from '../brand/t';
import { flowStore } from '../flow/flowStore';
import { recordError } from '../kiosk/auditError';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private timer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void recordError('render_error', error, info.componentStack ?? '');
    this.timer = setTimeout(() => {
      void flowStore.getState().resetToAttract('render_error');
      this.setState({ failed: false });
    }, brand.kiosk.errorRecoveryMs);
  }
  componentWillUnmount() {
    clearTimeout(this.timer);
  }
  render() {
    return this.state.failed ? (
      <main
        role="status"
        className="grid min-h-dvh place-items-center bg-bg px-5 font-body text-fg"
      >
        <p className="game-heading">{t('error.recovering')}</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
