import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DisplayLocale = "zh-CN" | "en";

type LocaleContextValue = Readonly<{
  locale: DisplayLocale;
  setLocale: (locale: DisplayLocale) => void;
}>;

const defaultLocaleContext: LocaleContextValue = {
  locale: "zh-CN",
  setLocale: () => undefined,
};

const LocaleContext = createContext<LocaleContextValue>(defaultLocaleContext);

export function getSuggestedDisplayLocale(
  languages: readonly string[] | undefined,
  language: string | undefined,
): DisplayLocale {
  const preferences = languages && languages.length > 0 ? languages : [language ?? ""];

  return preferences.some((preference) => preference.toLowerCase().startsWith("en"))
    ? "en"
    : "zh-CN";
}

export function getBrowserSuggestedDisplayLocale(): DisplayLocale {
  if (typeof navigator === "undefined") {
    return "zh-CN";
  }

  return getSuggestedDisplayLocale(navigator.languages, navigator.language);
}

export function LocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocale] = useState<DisplayLocale>(getBrowserSuggestedDisplayLocale);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function LocaleSwitch() {
  const { locale, setLocale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <div
      aria-label={isEnglish ? "Display language" : "展示语言"}
      className="locale-switch"
      role="group"
    >
      <button
        aria-pressed={!isEnglish}
        className="locale-switch__button"
        onClick={() => setLocale("zh-CN")}
        type="button"
      >
        中文
      </button>
      <button
        aria-pressed={isEnglish}
        className="locale-switch__button"
        onClick={() => setLocale("en")}
        type="button"
      >
        English
      </button>
    </div>
  );
}
