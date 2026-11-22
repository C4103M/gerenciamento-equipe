"use client";

import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatPeriodLabel,
  PERIOD_PRESET_OPTIONS,
  type PeriodFilterValue,
  type PeriodPreset,
} from "@/lib/period";
import { cn } from "@/lib/utils";

export interface PeriodFilterButtonProps {
  value: PeriodFilterValue;
  onChange: (next: PeriodFilterValue) => void;
  variant?: "header" | "filter";
  align?: "left" | "right";
  className?: string;
}

/**
 * Reusable dropdown/popover button for listing problems or dashboard metrics
 * across all-time (global) or specific date ranges.
 */
export function PeriodFilterButton({
  value,
  onChange,
  variant = "filter",
  align = "left",
  className,
}: PeriodFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from ?? "");
  const [customTo, setCustomTo] = useState(value.to ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setCustomFrom(value.from ?? "");
        setCustomTo(value.to ?? "");
      }
      return next;
    });
  }

  function handleSelectPreset(preset: Exclude<PeriodPreset, "custom">) {
    onChange({ preset });
    setOpen(false);
  }

  function handleApplyCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customFrom && !customTo) {
      onChange({ preset: "all" });
      setOpen(false);
      return;
    }

    let from = customFrom || undefined;
    let to = customTo || undefined;
    if (from && to && from > to) {
      [from, to] = [to, from];
    }

    onChange({ preset: "custom", from, to });
    setOpen(false);
  }

  const label = formatPeriodLabel(value);
  const isFiltered = value.preset !== "all";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center justify-between gap-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          variant === "header"
            ? cn(
                "rounded-lg border px-3.5 py-2 text-sm font-medium",
                isFiltered
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/20"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
              )
            : cn(
                "w-full rounded-lg border px-3 py-2 text-xs",
                isFiltered
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-700"
              )
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarRange
            className={cn(
              "shrink-0",
              variant === "header" ? "h-4 w-4" : "h-3.5 w-3.5",
              isFiltered ? "text-indigo-300" : "text-zinc-400"
            )}
            aria-hidden="true"
          />
          <span className="truncate">
            {variant === "header" ? `Período: ${label}` : label}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-zinc-400 transition-transform",
            variant === "header" ? "h-4 w-4" : "h-3.5 w-3.5",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Selecionar período"
          className={cn(
            "absolute z-40 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 shadow-2xl",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Listar por período
          </p>

          <div className="space-y-1">
            {PERIOD_PRESET_OPTIONS.map((option) => {
              const active = value.preset === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectPreset(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    active
                      ? "bg-indigo-500/20 text-indigo-200"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  )}
                >
                  <span>{option.label}</span>
                  {active ? (
                    <Check
                      className="h-3.5 w-3.5 text-indigo-400"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="my-2.5 border-t border-zinc-800" />

          <form onSubmit={handleApplyCustom} className="space-y-2.5">
            <p className="px-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              Período personalizado
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[11px] text-zinc-400">De</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] text-zinc-400">Até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleSelectPreset("all")}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                Global (Tudo)
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Aplicar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
