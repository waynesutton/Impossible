import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Delete",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="brutal-card max-w-md w-full mx-4"
        style={{ background: "var(--bg-primary)" }}
      >
        <h3 className="brutal-text-lg mb-4">{title}</h3>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="brutal-button text-sm px-4 py-2"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="brutal-button text-sm px-4 py-2"
            style={{
              background: "#dc2626",
              color: "white",
              borderColor: "#dc2626",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
