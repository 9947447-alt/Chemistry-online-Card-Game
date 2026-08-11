import { useLocale } from "./locale";

// This is the sole Forms endpoint. It intentionally carries no game or browser data.
export const feedbackFormUrl: string | undefined = "https://forms.cloud.microsoft/r/QG8PACUnsa";

export function FeedbackLink() {
  const { locale } = useLocale();

  if (!feedbackFormUrl) {
    return null;
  }

  const label = locale === "en"
    ? "Open Microsoft Forms feedback in a new tab"
    : "在新标签页打开 Microsoft Forms 反馈表";

  return (
    <a
      aria-label={label}
      className="feedback-link"
      href={feedbackFormUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {locale === "en" ? "Feedback (opens Microsoft Forms in a new tab)" : "反馈（将在新标签页打开 Microsoft Forms）"}
    </a>
  );
}
