import { useLocale } from "./locale";

export const projectRepositoryUrl =
  "https://github.com/9947447-alt/reaction-field";

export function ProjectRepositoryLink() {
  const { locale } = useLocale();
  const label = locale === "en"
    ? "Open the Reaction Field GitHub repository in a new tab"
    : "在新标签页打开反应域 GitHub 仓库";

  return (
    <a
      aria-label={label}
      className="project-repository-link"
      href={projectRepositoryUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {locale === "en"
        ? "GitHub repository (opens in a new tab)"
        : "GitHub 仓库（将在新标签页打开）"}
    </a>
  );
}
