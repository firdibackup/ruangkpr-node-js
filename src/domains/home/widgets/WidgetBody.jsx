import { Component, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/shared/ui";
import { WIDGET } from "../dashboardLayout";
import { WIDGET_VIEWS } from ".";
import { LockedWidget } from "./LockedWidget";
import { widgetLock } from "./widgetData";

// A widget that throws shows a small retry card instead of taking the whole Home page down.
class WidgetBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Panel className="items-start justify-center gap-2">
        <p className="text-sm font-bold">{this.props.title} gagal dimuat.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => this.setState({ failed: false })}
        >
          Coba lagi
        </Button>
      </Panel>
    );
  }
}

// What a board cell or gallery preview shows: the widget, or the shared locked state when its data is
// missing (Health and Peluang draw their own).
export function WidgetBody({ id, widgetProps }) {
  const lock = WIDGET[id].ownLock
    ? null
    : widgetLock(id, widgetProps.m, widgetProps.d);
  const View = WIDGET_VIEWS[id];
  return (
    <WidgetBoundary title={WIDGET[id].title}>
      <Suspense fallback={<Skeleton className="rounded-card" />}>
        {lock ? (
          <LockedWidget id={id} lock={lock} widgetProps={widgetProps} />
        ) : (
          <View {...widgetProps} />
        )}
      </Suspense>
    </WidgetBoundary>
  );
}
