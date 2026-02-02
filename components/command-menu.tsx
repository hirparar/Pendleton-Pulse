"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Item = {
  label: string;
  hint?: string;
  onSelect: () => void;
};

export function CommandMenu({
  items,
  placeholder = "Type a command or search…",
}: {
  items: Item[];
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-2xl p-0">
        <Command className="bg-background">
          <div className="border-b p-3">
            <Input
              placeholder={placeholder}
              className="h-11 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          <Command.List className="max-h-[380px] overflow-auto p-2">
            <Command.Empty className="p-6 text-sm text-muted-foreground">
              No results.
            </Command.Empty>

            <Command.Group heading="Actions" className="px-2 py-2 text-xs text-muted-foreground">
              {items.map((item) => (
                <Command.Item
                  key={item.label}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm aria-selected:bg-muted"
                  onSelect={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.hint ? (
                    <span className="text-xs text-muted-foreground">{item.hint}</span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
