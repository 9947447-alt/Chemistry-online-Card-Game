import { useRef } from "react";
import { ModalDialog } from "./ModalDialog";

export type SessionConfirmationKind = "restart" | "return";

type ConfirmationDialogProps = Readonly<{
  kind: SessionConfirmationKind;
  onCancel: () => void;
  onConfirm: () => void;
}>;

const confirmationCopy: Readonly<Record<SessionConfirmationKind, Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
}>>> = {
  restart: {
    title: "确认按当前阵容重开？",
    description: "当前对局、双方手牌、状态和日志将被丢弃，并按当前阵容创建一局全新的游戏。",
    confirmLabel: "确认重开",
  },
  return: {
    title: "确认返回角色选择？",
    description: "当前对局、双方手牌、状态和日志将被丢弃；当前阵容会保留供你继续调整。",
    confirmLabel: "确认返回",
  },
};

export function ConfirmationDialog({
  kind,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const copy = confirmationCopy[kind];

  return (
    <ModalDialog
      ariaDescribedBy="session-confirmation-description"
      ariaLabelledBy="session-confirmation-title"
      className="confirmation-dialog"
      initialFocusRef={cancelButtonRef}
      onRequestClose={onCancel}
      role="alertdialog"
    >
        <h2 id="session-confirmation-title">{copy.title}</h2>
        <p id="session-confirmation-description">{copy.description}</p>
        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            取消
          </button>
          <button className="danger-button" onClick={onConfirm} type="button">
            {copy.confirmLabel}
          </button>
        </div>
    </ModalDialog>
  );
}
