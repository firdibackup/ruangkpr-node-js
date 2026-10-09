import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useContainerWidth } from "react-grid-layout";
import { CheckIcon, LockIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/dialogs";
import { Chip } from "@/components/shared/ui";
import {
  CATEGORIES,
  WIDGETS,
  contentZoom,
  defaultCellSize,
} from "./dashboardLayout";
import { WidgetBody } from "./widgets/WidgetBody";
import { widgetLock } from "./widgets/widgetData";

const TABS = [{ id: "all", label: "Semua" }, ...CATEGORIES];
const PREVIEW_HEIGHT = 168;

// "Tambah widget": each widget as a live preview with the user's own data. A widget whose data is missing
// can't be added; its card offers the step that fills the gap instead. Only the open tab renders previews.
export function WidgetGallery({
  open,
  onOpenChange,
  layout,
  widgetProps,
  onAdd,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const onBoard = new Set(layout.map((l) => l.i));
  const unlock = (lock) => {
    onOpenChange(false);
    const ask = {
      income: widgetProps.onAskIncome,
      property: widgetProps.onAskProperty,
    }[lock.action.kind];
    if (ask) ask();
    else navigate(lock.action.to);
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah widget"
      description="Pilih widget untuk dashboard kamu. Widget baru mengisi ruang kosong pertama yang muat."
      className="max-w-[960px]"
    >
      <TabsPrimitive.Root
        value={tab}
        onValueChange={setTab}
        className="flex flex-col gap-4"
      >
        <TabsPrimitive.List
          aria-label="Kategori widget"
          className="flex w-full max-w-full gap-1 self-start overflow-x-auto rounded-full border border-border bg-card p-1 sm:w-fit"
        >
          {TABS.map((t) => (
            <TabsPrimitive.Trigger
              key={t.id}
              value={t.id}
              className="h-11 shrink-0 rounded-full px-4 text-sm font-bold text-ink-3 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              {t.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {TABS.map((t) => (
          <TabsPrimitive.Content
            key={t.id}
            value={t.id}
            className="outline-none"
          >
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WIDGETS.filter((w) => t.id === "all" || w.category === t.id).map(
                (w) => (
                  <GalleryCard
                    key={w.id}
                    widget={w}
                    added={onBoard.has(w.id)}
                    lock={widgetLock(w.id, widgetProps.m, widgetProps.d)}
                    widgetProps={widgetProps}
                    onAdd={onAdd}
                    onUnlock={unlock}
                  />
                ),
              )}
            </ul>
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </FormDialog>
  );
}

function GalleryCard({ widget: w, added, lock, widgetProps, onAdd, onUnlock }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Preview id={w.id} widgetProps={widgetProps} />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-extrabold">{w.title}</h3>
          {added ? (
            <Chip tone="ok" icon={CheckIcon}>
              Sudah ada
            </Chip>
          ) : (
            lock && (
              <Chip tone="mute" icon={LockIcon}>
                {lock.reason}
              </Chip>
            )
          )}
        </div>
        <p className="text-[13px] leading-5 text-ink-3">{w.description}</p>
        {!added && (lock ? lock.action : true) && (
          <div className="mt-auto pt-2">
            {lock ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUnlock(lock)}
                aria-label={`Lengkapi data untuk ${w.title}`}
              >
                <LockIcon aria-hidden />
                Lengkapi data
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onAdd(w.id)}
                aria-label={`Tambah ${w.title}`}
              >
                <PlusIcon aria-hidden />
                Tambah
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// The widget at its default cell size, scaled down to the card. Purely visual: the card text says what it is.
function Preview({ id, widgetProps }) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const cell = defaultCellSize(id);
  const scale = Math.min(
    (width - 24) / cell.width,
    (PREVIEW_HEIGHT - 24) / cell.height,
  );
  return (
    <div
      ref={containerRef}
      inert
      aria-hidden
      className="relative h-[168px] shrink-0 overflow-hidden bg-muted"
    >
      {mounted && width > 0 && (
        <div
          className="absolute top-1/2 left-1/2 [container-type:size]"
          style={{
            width: cell.width,
            height: cell.height,
            fontSize: contentZoom(id),
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <div className="h-full *:h-full">
            <WidgetBody id={id} widgetProps={widgetProps} />
          </div>
        </div>
      )}
    </div>
  );
}
