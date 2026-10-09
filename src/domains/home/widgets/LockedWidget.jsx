import { Suspense, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LockedPreview } from "../dashboardWidgets";
import { WIDGET } from "../dashboardLayout";
import { WIDGET_VIEWS } from ".";
import { sampleWidgetProps } from "./widgetData";

// Shared locked state, same look as Health and Peluang: the widget itself with example data under frosted
// glass, what is missing, and the one action that fills it.
export function LockedWidget({ id, lock, widgetProps }) {
  const navigate = useNavigate();
  const View = WIDGET_VIEWS[id];
  const sample = useMemo(
    () => sampleWidgetProps(widgetProps.clock),
    [widgetProps.clock],
  );
  const act =
    lock.action &&
    ({ income: widgetProps.onAskIncome, property: widgetProps.onAskProperty }[
      lock.action.kind
    ] ??
      (() => navigate(lock.action.to)));
  return (
    <LockedPreview
      preview={
        <div className="h-full *:h-full">
          <Suspense fallback={null}>
            <View {...sample} />
          </Suspense>
        </div>
      }
      title={`Buka ${WIDGET[id].title}`}
      action={
        lock.action && (
          <Button size="sm" onClick={act}>
            {lock.action.label}
          </Button>
        )
      }
    >
      {lock.title}
    </LockedPreview>
  );
}
