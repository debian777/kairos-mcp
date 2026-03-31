import type { TFunction } from "i18next";
import { SpaceSelect } from "@/components/SpaceSelect";
import type { SpaceInfo } from "@/hooks/useSpaces";

type ProtocolEditSpaceSectionProps = {
  t: TFunction;
  isNew: boolean;
  spaces: SpaceInfo[] | undefined;
  spacesLoading: boolean;
  targetSpace: string;
  setTargetSpace: (v: string) => void;
  forkSourceUri: string;
  setForkSourceUri: (v: string) => void;
  moveSpace: string;
  setMoveSpace: (v: string) => void;
};

export function ProtocolEditSpaceSection({
  t,
  isNew,
  spaces,
  spacesLoading,
  targetSpace,
  setTargetSpace,
  forkSourceUri,
  setForkSourceUri,
  moveSpace,
  setMoveSpace,
}: ProtocolEditSpaceSectionProps) {
  return (
    <section className="mb-8 space-y-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5">
      {isNew ? (
        <>
          <div>
            <label
              htmlFor="protocol-target-space"
              className="mb-2 block font-medium text-[var(--color-text-heading)]"
            >
              {t("protocolEdit.targetSpaceLabel")}
            </label>
            <SpaceSelect
              id="protocol-target-space"
              spaces={spaces}
              value={targetSpace}
              onChange={setTargetSpace}
              disabled={spacesLoading}
            />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.targetSpaceHint")}</p>
          </div>
          <div>
            <label
              htmlFor="protocol-fork-source"
              className="mb-2 block font-medium text-[var(--color-text-heading)]"
            >
              {t("protocolEdit.forkSourceLabel")}
            </label>
            <input
              id="protocol-fork-source"
              type="text"
              value={forkSourceUri}
              onChange={(e) => setForkSourceUri(e.target.value)}
              placeholder={t("protocolEdit.forkSourcePlaceholder")}
              autoComplete="off"
              className="min-h-[44px] w-full max-w-2xl rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.forkSourceHint")}</p>
          </div>
        </>
      ) : (
        <div>
          <label
            htmlFor="protocol-move-space"
            className="mb-2 block font-medium text-[var(--color-text-heading)]"
          >
            {t("protocolEdit.moveSpaceLabel")}
          </label>
          <SpaceSelect
            id="protocol-move-space"
            spaces={spaces}
            value={moveSpace}
            onChange={setMoveSpace}
            disabled={spacesLoading}
          />
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.moveSpaceHint")}</p>
        </div>
      )}
    </section>
  );
}
