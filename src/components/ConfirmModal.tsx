import React from "react";
import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary" | "emerald";
  itemCount?: number;
  itemLabel?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  itemCount,
  itemLabel = "record(s)",
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
          iconBg: "bg-red-50 border-red-100",
          btnBg: "bg-red-600 hover:bg-red-700 text-white shadow-red-200",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: "bg-amber-50 border-amber-100",
          btnBg: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
        };
      case "emerald":
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: "bg-emerald-50 border-emerald-100",
          btnBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200",
        };
      case "primary":
      default:
        return {
          icon: <Info className="w-6 h-6 text-indigo-600" />,
          iconBg: "bg-indigo-50 border-indigo-100",
          btnBg: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl border shrink-0 ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {description}
              </p>
              {itemCount !== undefined && itemCount > 0 && (
                <div className="mt-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                  {itemCount} {itemLabel} will be affected.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
            <button
              id="btn-confirm-modal-cancel"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              {cancelText}
            </button>
            <button
              id="btn-confirm-modal-action"
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-xs cursor-pointer transition-colors ${styles.btnBg}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
