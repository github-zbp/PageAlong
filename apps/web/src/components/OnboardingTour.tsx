"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon, CloseIcon } from "./UiIcons";

export type DashboardGuideStep = {
  key: string;
  target: string;
  targetLabel: string;
  title: string;
  body: string;
};

export type DashboardGuideCopy = {
  title: string;
  subtitle: string;
  steps: readonly DashboardGuideStep[];
  next: string;
  complete: string;
  stepLabel: string;
  close: string;
  buttonLabel: string;
};

export type DashboardGuideConfig = DashboardGuideCopy & {
  initialOpen: boolean;
  onComplete: () => void;
};

type Props = {
  copy: DashboardGuideCopy;
  open: boolean;
  sessionKey: number;
  onActiveTargetChange: (target: string | null) => void;
  onClose: () => void;
  onComplete: () => void;
};

function formatStepLabel(template: string, current: number, total: number) {
  return template.replace("{current}", String(current)).replace("{total}", String(total));
}

function escapeTargetSelector(target: string): string {
  return target.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function useViewportSize(open: boolean) {
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 0, height: 0 }
  );

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, [open]);

  return viewport;
}

function findTargetElement(target: string): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector(`[data-guide-target="${escapeTargetSelector(target)}"]`) as HTMLElement | null;
}

export function DashboardGuideOverlay({ copy, onActiveTargetChange, onClose, onComplete, open, sessionKey }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const transitionLockedRef = useRef(false);
  const viewport = useViewportSize(open);
  const currentStep = copy.steps[activeIndex] ?? copy.steps[0];
  const currentTarget = currentStep?.target ?? null;
  const isLastStep = activeIndex >= copy.steps.length - 1;

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTargetRect(null);
      transitionLockedRef.current = false;
    } else {
      setTargetRect(null);
      onActiveTargetChange(null);
    }
  }, [open, onActiveTargetChange, sessionKey]);

  useEffect(() => {
    if (open) {
      onActiveTargetChange(currentTarget);
    }
  }, [currentTarget, onActiveTargetChange, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const measure = () => {
      const target = currentTarget ? findTargetElement(currentTarget) : null;
      setTargetRect(target?.getBoundingClientRect() ?? null);
    };

    const target = currentTarget ? findTargetElement(currentTarget) : null;
    const observer = target && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let rafId = requestAnimationFrame(measure);

    if (target) {
      observer?.observe(target);
      target.scrollIntoView({ block: "center", inline: "nearest" });
    } else {
      retryTimer = setTimeout(measure, 250);
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      cancelAnimationFrame(rafId);
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [currentTarget, open, sessionKey]);

  useEffect(() => {
    if (open) {
      primaryButtonRef.current?.focus();
    }
  }, [activeIndex, open, sessionKey]);

  const releaseTransitionLock = () => {
    setTimeout(() => {
      transitionLockedRef.current = false;
    }, 50);
  };

  const handlePrimaryPress = () => {
    if (transitionLockedRef.current) {
      return;
    }

    transitionLockedRef.current = true;
    if (isLastStep) {
      onComplete();
      onClose();
      releaseTransitionLock();
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, copy.steps.length - 1));
    releaseTransitionLock();
  };

  const cardPlacement = useMemo(() => {
    if (!open) {
      return null;
    }

    const compact = !targetRect || viewport.width < 900 || viewport.width - targetRect.right < 400;

    if (compact) {
      return {
        compact: true as const,
        style: {
          left: 16,
          right: 16,
          bottom: 16
        }
      };
    }

    const width = Math.min(368, Math.max(304, viewport.width - 32));
    const left = Math.min(Math.max(targetRect.right + 16, 16), Math.max(16, viewport.width - width - 16));
    const top = Math.min(Math.max(targetRect.top - 12, 16), Math.max(16, viewport.height - 320));

    return {
      compact: false as const,
      style: {
        left,
        top,
        width
      }
    };
  }, [open, targetRect, viewport.height, viewport.width]);

  if (!open) {
    return null;
  }

  const highlightStyle = targetRect
    ? {
        left: Math.max(8, targetRect.left - 8),
        top: Math.max(8, targetRect.top - 8),
        width: targetRect.width + 16,
        height: targetRect.height + 16
      }
    : null;

  return (
    <div aria-labelledby="dashboard-guide-title" aria-modal="true" className="fixed inset-0 z-50" role="dialog">
      <div className="absolute inset-0 bg-black/35" onMouseDown={onClose} />

      {highlightStyle ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-md border border-[var(--pa-green)]"
          style={{
            boxShadow: "0 0 0 9999px rgba(10, 18, 30, 0.48)",
            ...highlightStyle
          }}
        />
      ) : null}

      <div
        className={[
          "fixed z-[60] rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] shadow-2xl",
          cardPlacement?.compact ? "max-w-none" : "w-[min(23rem,calc(100vw-2rem))]"
        ].join(" ")}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          visibility: targetRect ? "visible" : "hidden",
          ...(cardPlacement?.style ?? {})
        }}
      >
        <div className="border-b border-[var(--pa-line)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="dashboard-guide-title" className="sr-only">
                {copy.title}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
                {formatStepLabel(copy.stepLabel, activeIndex + 1, copy.steps.length)}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--pa-muted)]">{copy.subtitle}</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--pa-ink)]">
                {currentStep.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{currentStep.body}</p>
              <span className="mt-3 inline-flex rounded-full border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] px-2 py-1 text-xs text-[var(--pa-muted)]">
                {currentStep.targetLabel}
              </span>
            </div>
            <button
              aria-label={copy.close}
              className="pa-focus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:text-[var(--pa-ink)]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex gap-2">
            {copy.steps.map((step, index) => (
              <span
                className={[
                  "h-1.5 flex-1 rounded-full",
                  index <= activeIndex ? "bg-[var(--pa-green)]" : "bg-[var(--pa-line)]"
                ].join(" ")}
                key={step.key}
                style={{ opacity: index === activeIndex ? 1 : 0.52 }}
              />
            ))}
          </div>

          <div className="flex items-center justify-end">
            <button
              ref={primaryButtonRef}
              className="pa-focus inline-flex h-10 items-center gap-2 rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
              onClick={handlePrimaryPress}
              type="button"
            >
              {isLastStep ? copy.complete : copy.next}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardGuideOverlay;
