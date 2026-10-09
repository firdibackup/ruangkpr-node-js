import { useEffect, useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import { toast } from "sonner";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EllipsisIcon,
  EyeOffIcon,
  FoldHorizontalIcon,
  FoldVerticalIcon,
  GripVerticalIcon,
  LayoutDashboardIcon,
  PlusIcon,
  RotateCcwIcon,
  UnfoldHorizontalIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import { api } from "@/data/api";
import { Button } from "@/components/ui/button";
import { UnsavedChangesGuard } from "@/components/shared/dialogs";
import { EmptyState } from "@/components/shared/ui";
import {
  COLS,
  DEFAULT_LAYOUT,
  GAP,
  GRID_MIN_WIDTH,
  MAX_H,
  ROW_HEIGHT,
  UNLOCKED_LAYOUT,
  WIDGET,
  addWidget,
  contentZoom,
  moveWidget,
  readingOrder,
  removeWidget,
  resizeWidget,
  sameLayout,
} from "./dashboardLayout";
import { WidgetGallery } from "./WidgetGallery";
import { WidgetBody } from "./widgets/WidgetBody";
import { widgetLock } from "./widgets/widgetData";

const GRID = {
  cols: COLS,
  rowHeight: ROW_HEIGHT,
  margin: [GAP, GAP],
  containerPadding: [0, 0],
};
const withLimits = (l) => ({
  ...l,
  minW: WIDGET[l.i].minW,
  minH: WIDGET[l.i].minH,
  maxH: MAX_H,
});
const pick = ({ i, x, y, w, h }) => ({ i, x, y, w, h });

// Home widgets the user can add, hide, move, and resize. Edits stay in a draft until "Simpan".
// Edit mode is owned by the page, whose header holds the "Atur Dashboard" button.
export function WidgetBoard({
  layout: initial,
  widgetProps,
  editing,
  onEditingChange,
  onSaved,
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(null); // null until the first edit
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(null);
  const [status, setStatus] = useState("");
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  // Never customised (saved is null), the board follows the default for the user's data: Peluang and Health
  // lead once both unlock. Saving the default stores null again, so a reset keeps following the data.
  const fallback = ["opportunity", "health"].some((id) =>
    widgetLock(id, widgetProps.m, widgetProps.d),
  )
    ? DEFAULT_LAYOUT
    : UNLOCKED_LAYOUT;
  const current = saved ?? fallback;
  const layout = (editing && draft) || current;
  const grid = width >= GRID_MIN_WIDTH;
  const dirty = editing && !sameLayout(layout, current);

  const edit = (next, message) => {
    setDraft(next);
    setStatus(message);
  };
  const close = () => {
    setDraft(null);
    setAdded(null);
    onEditingChange(false);
  };
  const save = async () => {
    if (!dirty) return close();
    setSaving(true);
    try {
      setSaved(
        await api.dashboard.saveLayout(
          sameLayout(draft, fallback) ? null : draft,
        ),
      );
      close();
      onSaved();
      toast.success("Susunan dashboard disimpan.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const cell = (l) => (
    <Widget
      id={l.i}
      editing={editing}
      grid={grid}
      layout={layout}
      onEdit={edit}
      scrollIntoView={l.i === added}
      widgetProps={widgetProps}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {editing && (
        <div data-tour="arrange-panel" className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-card lg:sticky lg:top-4 lg:z-20 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-base font-extrabold">Atur Dashboard</h2>
            <p className="text-[13px] leading-5 text-ink-3">
              {grid
                ? "Tarik ⠿ untuk memindah dan sudut kiri atas atau kanan bawah untuk mengubah ukuran, atau pakai menu ⋯."
                : "Sembunyikan atau tambah widget. Posisi dan ukuran diatur di layar yang lebih lebar."}
            </p>
          </div>
          {/* Two by two on a phone, one row from sm up. */}
          <div data-tour="arrange-actions" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="max-sm:px-3"
              data-tour="arrange-add"
              onClick={() => setAdding(true)}
            >
              <PlusIcon aria-hidden />
              Tambah widget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:px-3"
              disabled={sameLayout(layout, fallback)}
              onClick={() => edit(fallback, "Susunan dikembalikan ke default.")}
            >
              <RotateCcwIcon aria-hidden />
              {/* One flex item, so the button gap doesn't split the label. */}
              <span>
                Reset<span className="max-sm:hidden"> ke default</span>
              </span>
            </Button>
            <Button variant="neutral" size="sm" onClick={close}>
              Batal
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      )}

      <div ref={containerRef}>
        {mounted &&
          (layout.length === 0 ? (
            <EmptyState
              icon={LayoutDashboardIcon}
              title="Dashboard kamu masih kosong."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    onEditingChange(true);
                    setAdding(true);
                  }}
                >
                  <PlusIcon aria-hidden />
                  Tambah widget
                </Button>
              }
            >
              Tambahkan widget yang ingin kamu pantau di Home.
            </EmptyState>
          ) : grid ? (
            <GridLayout
              width={width}
              layout={layout.map(withLimits)}
              gridConfig={GRID}
              dragConfig={{ enabled: editing, handle: ".widget-handle" }}
              resizeConfig={{ enabled: editing, handles: ["nw", "se"] }}
              compactor={verticalCompactor}
              onLayoutChange={(next) =>
                editing &&
                setDraft((cur) =>
                  sameLayout(cur ?? current, next) ? cur : next.map(pick),
                )
              }
            >
              {/* Reading order keeps the tab order in step with what the user sees. */}
              {readingOrder(layout).map((l) => (
                <div
                  key={l.i}
                  data-tour={l.i}
                  role="group"
                  aria-label={WIDGET[l.i].title}
                  className="[container-type:size]"
                >
                  {cell(l)}
                </div>
              ))}
            </GridLayout>
          ) : (
            // ponytail: phones follow the grid's reading order and can only hide/add; add ↑↓ moves here if phone-only users need to reorder.
            <div className="flex flex-col gap-5">
              {readingOrder(layout).map((l) => (
                <div
                  key={l.i}
                  data-tour={l.i}
                  role="group"
                  aria-label={WIDGET[l.i].title}
                  className="relative @container"
                >
                  {cell(l)}
                </div>
              ))}
            </div>
          ))}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <WidgetGallery
        open={adding}
        onOpenChange={setAdding}
        layout={layout}
        widgetProps={widgetProps}
        onAdd={(id) => {
          edit(addWidget(layout, id), `${WIDGET[id].title} ditambahkan.`);
          setAdded(id);
          setAdding(false);
        }}
      />

      <UnsavedChangesGuard when={dirty} />
    </div>
  );
}

function Widget({
  id,
  editing,
  grid,
  layout,
  onEdit,
  scrollIntoView,
  widgetProps,
}) {
  const { title } = WIDGET[id];
  const ref = useRef(null);
  useEffect(() => {
    if (scrollIntoView) ref.current?.scrollIntoView({ block: "center" });
  }, [scrollIntoView]);
  return (
    <>
      {/* Content can't be clicked while editing; a cell shorter than its content scrolls instead of clipping. */}
      <div
        ref={ref}
        inert={editing}
        className="h-full *:h-full *:overflow-y-auto *:scroll-thin"
        style={grid ? { fontSize: contentZoom(id) } : undefined}
      >
        <WidgetBody id={id} widgetProps={widgetProps} />
      </div>
      {editing && (
        <div className="pointer-events-none absolute inset-0 rounded-card outline-2 -outline-offset-2 outline-primary/40 outline-dashed">
          <div className="pointer-events-auto absolute top-3 right-3 flex gap-1.5">
            {grid ? (
              <>
                <span
                  data-tour="widget-move"
                  className="widget-handle flex size-11 cursor-grab touch-none items-center justify-center rounded-xl border border-border bg-card text-ink-3 shadow-card active:cursor-grabbing"
                  title={`Tarik untuk memindah ${title}`}
                >
                  <GripVerticalIcon className="size-5" aria-hidden />
                </span>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      variant="neutral"
                      size="icon"
                      className="shadow-card"
                      data-tour="widget-menu"
                      aria-label={`Atur ${title}`}
                    >
                      <EllipsisIcon className="size-5" aria-hidden />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 flex min-w-56 flex-col rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0"
                    >
                      <WidgetActions id={id} layout={layout} onEdit={onEdit} />
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </>
            ) : (
              <Button
                variant="neutral"
                size="icon"
                className="shadow-card"
                data-tour="widget-hide"
                aria-label={`Sembunyikan ${title}`}
                onClick={() =>
                  onEdit(removeWidget(layout, id), `${title} disembunyikan.`)
                }
              >
                <EyeOffIcon className="size-5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm font-bold outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-muted-foreground data-[highlighted]:bg-muted";

// Keyboard and touch twin of drag/resize. Rendered only while the menu is open; an action that
// would change nothing is disabled.
function WidgetActions({ id, layout, onEdit }) {
  const { title } = WIDGET[id];
  const item = (
    label,
    Icon,
    next,
    message = `${title}: ${label.toLowerCase()}.`,
  ) => (
    <DropdownMenu.Item
      key={label}
      className={MENU_ITEM}
      disabled={sameLayout(next, layout)}
      onSelect={() => onEdit(next, message)}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </DropdownMenu.Item>
  );
  return (
    <>
      {item("Geser ke atas", ArrowUpIcon, moveWidget(layout, id, "up"))}
      {item("Geser ke bawah", ArrowDownIcon, moveWidget(layout, id, "down"))}
      {item("Geser ke kiri", ArrowLeftIcon, moveWidget(layout, id, "left"))}
      {item("Geser ke kanan", ArrowRightIcon, moveWidget(layout, id, "right"))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      {item("Perlebar", UnfoldHorizontalIcon, resizeWidget(layout, id, 1, 0))}
      {item("Persempit", FoldHorizontalIcon, resizeWidget(layout, id, -1, 0))}
      {item("Pertinggi", UnfoldVerticalIcon, resizeWidget(layout, id, 0, 1))}
      {item("Perpendek", FoldVerticalIcon, resizeWidget(layout, id, 0, -1))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      {item(
        "Sembunyikan",
        EyeOffIcon,
        removeWidget(layout, id),
        `${title} disembunyikan.`,
      )}
    </>
  );
}
