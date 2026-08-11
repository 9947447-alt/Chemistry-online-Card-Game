import { Component, type ErrorInfo, type ReactNode } from "react";
import { RootFailurePage } from "./RootFailurePage";

type RootErrorBoundaryProps = Readonly<{
  children: ReactNode;
}>;

type RootErrorBoundaryState = Readonly<{
  failed: boolean;
}>;

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: unknown, _errorInfo: ErrorInfo): void {
    // 原始异常只由 React 在内存中传递；此边界不记录、不展示，也不上传。
  }

  render(): ReactNode {
    return this.state.failed
      ? <RootFailurePage code="UI_RENDER_FAILED" />
      : this.props.children;
  }
}
