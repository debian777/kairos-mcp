import { useTranslation } from "react-i18next";
import { ErrorAlert } from "@/components/ErrorAlert";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-4">
        {t("notFound.title")}
      </h1>
      <ErrorAlert
        message={t("notFound.message")}
        showGoBack={true}
      />
    </div>
  );
}
