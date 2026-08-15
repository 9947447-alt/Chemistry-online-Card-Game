import { useRef } from "react";
import { useLocale } from "../../../app/locale";
import { ModalDialog } from "./ModalDialog";

export type SessionConfirmationKind = "restart" | "return";

type ConfirmationDialogProps = Readonly<{
  kind: SessionConfirmationKind;
  onCancel: () => void;
  onConfirm: () => void;
}>;

type CopyTuple = readonly [title: string, description: string, confirmLabel: string];

const copyData: Readonly<Record<SessionConfirmationKind, readonly [CopyTuple, CopyTuple]>> = {
  restart: [
    [
      "确认按当前阵容重开？",
      "当前对局、双方手牌、状态和日志将被丢弃，并按当前阵容创建一局全新的游戏。",
      "确认重开",
    ],
    [
      "Restart with the current lineup?",
      "The current game, both hands, statuses, and log will be discarded. A completely new game will be created with the current lineup.",
      "Confirm restart",
    ],
  ],
  return: [
    [
      "确认返回角色选择？",
      "当前对局、双方手牌、状态和日志将被丢弃；当前阵容会保留供你继续调整。",
      "确认返回",
    ],
    [
      "Return to character selection?",
      "The current game, both hands, statuses, and log will be discarded. The current lineup remains available for adjustment.",
      "Confirm return",
    ],
  ],
};

export function ConfirmationDialog({
  kind,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { locale } = useLocale();
  const [title, description, confirmLabel] = copyData[kind][locale === "en" ? 1 : 0];

  return (
    <ModalDialog
      ariaDescribedBy="session-confirmation-description"
      ariaLabelledBy="session-confirmation-title"
      className="confirmation-dialog"
      initialFocusRef={cancelButtonRef}
      onRequestClose={onCancel}
      role="alertdialog"
    >
        <h2 id="session-confirmation-title">{title}</h2>
        <p id="session-confirmation-description">{description}</p>
        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {locale === "en" ? "Cancel" : "取消"}
          </button>
          <button className="danger-button" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
    </ModalDialog>
  );
}
