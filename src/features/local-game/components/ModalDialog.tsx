import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ModalDialogProps = Readonly<{
  ariaDescribedBy: string;
  ariaLabelledBy: string;
  children: ReactNode;
  className: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  onRequestClose: () => void;
  role: "alertdialog" | "dialog";
}>;

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

export function ModalDialog({
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className,
  initialFocusRef,
  onRequestClose,
  role,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const initialFocus = initialFocusRef.current ?? getFocusableElements(dialog)[0] ?? dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutside = activeElement === null || !dialog.contains(activeElement);

      if (event.shiftKey && (activeElement === first || focusIsOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [initialFocusRef]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={`modal-card ${className}`}
        ref={dialogRef}
        role={role}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}
