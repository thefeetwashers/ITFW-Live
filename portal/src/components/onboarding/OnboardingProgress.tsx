"use client";

export type OnboardingStatus =
  | "role_selected"
  | "profile_completed"
  | "pending_verification"
  | "active";

const STEPS: { id: OnboardingStatus; label: string }[] = [
  { id: "role_selected", label: "Role selected" },
  { id: "profile_completed", label: "Profile completed" },
  { id: "pending_verification", label: "Pending verification" },
  { id: "active", label: "Active" },
];

export default function OnboardingProgress({
  status,
  started,
}: {
  status: OnboardingStatus;
  started: boolean;
}) {
  const currentIndex = started
    ? STEPS.findIndex((s) => s.id === status)
    : -1;
  return (
    <ol
      aria-label="Onboarding progress"
      className="flex flex-wrap items-center gap-2 text-xs sm:text-sm"
    >
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-current={current ? "step" : undefined}
              className={
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium " +
                (current
                  ? "border-blue-600 bg-blue-600 text-white"
                  : done
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-slate-300 bg-white text-slate-500")
              }
            >
              <span
                className={
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold " +
                  (current
                    ? "bg-white text-blue-600"
                    : done
                      ? "bg-green-600 text-white"
                      : "bg-slate-200 text-slate-600")
                }
              >
                {done ? "✓" : i + 1}
              </span>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="text-slate-300">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
