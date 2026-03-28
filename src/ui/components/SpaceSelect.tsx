import { useTranslation } from "react-i18next";
import type { SpaceInfo } from "@/hooks/useSpaces";

export interface SpaceSelectProps {
  id: string;
  spaces: SpaceInfo[] | undefined;
  value: string;
  onChange: (spaceIdOrEmpty: string) => void;
  /** When true, first option is “all spaces” with value "". */
  includeAllOption?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
}

const typeBadgeClass: Record<SpaceInfo["type"], string> = {
  personal: "bg-[var(--badge-personal-bg)] text-[var(--badge-personal-fg)]",
  group: "bg-[var(--badge-group-bg)] text-[var(--badge-group-fg)]",
  app: "bg-[var(--badge-app-bg)] text-[var(--badge-app-fg)]",
  other: "bg-[var(--badge-other-bg)] text-[var(--badge-other-fg)]",
};

export function SpaceSelect({
  id,
  spaces,
  value,
  onChange,
  includeAllOption = false,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
}: SpaceSelectProps) {
  const { t } = useTranslation();
  const list = spaces ?? [];

  return (
    <select
      id={id}
      value={value}
      disabled={disabled || (list.length === 0 && !includeAllOption)}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={ariaDescribedBy}
      className="min-h-[44px] w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
    >
      {includeAllOption ? (
        <option value="">{t("spaces.filterAll")}</option>
      ) : null}
      {list.map((s) => (
        <option key={s.space_id} value={s.space_id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/** Compact type badge for labels (not for native select options). */
export function SpaceTypeBadge({ type }: { type: SpaceInfo["type"] }) {
  const { t } = useTranslation();
  const label = t(`spaces.type.${type}`);
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${typeBadgeClass[type]}`}
    >
      {label}
    </span>
  );
}
