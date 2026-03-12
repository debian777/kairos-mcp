import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface CopyButtonProps {
  /** Text to copy to clipboard */
  value: string;
  /** Accessible label (e.g. "Copy URI") */
  label: string;
  /** Optional class name for the button */
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={copied ? t("run.copied") : label}
      title={label}
    >
      {copied ? t("run.copied") : t("run.copy")}
    </button>
  );
}
