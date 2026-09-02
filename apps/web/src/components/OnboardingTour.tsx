"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { ArrowRightIcon, DashboardIcon, ImportIcon, LibraryIcon } from "./UiIcons";

const STEP_ICONS = [ImportIcon, DashboardIcon, LibraryIcon] as const;

type Props = {
  copy: Dictionary["dashboard"]["onboarding"];
  open: boolean;
  onComplete: () => void;
};

export function OnboardingTour({ copy, onComplete, open }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const transitionLockedRef = useRef(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      primaryButtonRef.current?.focus();
    }
  }, [activeIndex, open]);

  if (!open) {
    return null;
  }

  const currentStep = copy.steps[activeIndex] ?? copy.steps[0];
  const StepIcon = STEP_ICONS[activeIndex] ?? STEP_ICONS[STEP_ICONS.length - 1];
  const isLastStep = activeIndex >= copy.steps.length - 1;

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
      releaseTransitionLock();
      return;
    }
    setActiveIndex((current) => Math.min(current + 1, copy.steps.length - 1));
    releaseTransitionLock();
  };

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 bg-black/50 p-4" role="dialog" aria-labelledby="onboarding-title">
      <div className="flex min-h-full items-center justify-center">
        <section className="w-full max-w-lg rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] shadow-2xl">
          <div className="border-b border-[var(--pa-line)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="onboarding-title" className="text-lg font-semibold text-[var(--pa-ink)]">
                  {copy.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{copy.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)]">
                {copy.stepLabel(activeIndex + 1, copy.steps.length)}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-green)]">
                <StepIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-2">
                <h3 className="text-base font-semibold text-[var(--pa-ink)]">{currentStep.title}</h3>
                <p className="text-sm leading-6 text-[var(--pa-muted)]">{currentStep.body}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {copy.steps.map((step, index) => (
                <span
                  key={step.key}
                  className={[
                    "h-1.5 flex-1 rounded-full",
                    index <= activeIndex ? "bg-[var(--pa-green)]" : "bg-[var(--pa-line)]"
                  ].join(" ")}
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
        </section>
      </div>
    </div>
  );
}

export default OnboardingTour;
