import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemCount?: number;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {description}
              </p>
              {itemCount !== undefined && itemCount > 0 && (
                <div className="mt-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                  {itemCount} lead record(s) will be permanently deleted.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
            <button
              id="btn-cancel-delete"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete"
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs shadow-red-200 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
