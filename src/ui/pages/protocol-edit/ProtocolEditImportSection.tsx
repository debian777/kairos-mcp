import type { RefObject } from "react";
import { Link } from "react-router-dom";
import type { TFunction } from "i18next";
import { SurfaceCard } from "@/components/SurfaceCard";

type ProtocolEditImportSectionProps = {
  t: TFunction;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isNew: boolean;
  decodedUri: string | undefined;
};

export function ProtocolEditImportSection({
  t,
  fileInputRef,
  onUpload,
  isNew,
  decodedUri,
}: ProtocolEditImportSectionProps) {
  return (
    <SurfaceCard
      className="mb-8"
      title={t("protocolEdit.importCardTitle")}
      subtitle={t("protocolEdit.uploadHint")}
    >
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={onUpload}
          className="sr-only"
          id="protocol-upload"
          aria-label={t("protocolEdit.upload")}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("protocolEdit.upload")}
        </button>
        {!isNew && decodedUri && (
          <Link
            to={`/protocols/${encodeURIComponent(decodedUri)}/skill`}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("protocol.editAsSkill")}
          </Link>
        )}
      </div>
    </SurfaceCard>
  );
}
