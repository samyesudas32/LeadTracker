import React, { useState, useEffect } from "react";
import { X, Save, User, Calendar, Phone, Mail, MapPin, FileText, Receipt, ShieldCheck, Users } from "lucide-react";
import { Lead, CallStatus } from "../types";

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLead: (lead: Lead) => void;
  initialLead?: Lead | null;
  handlers?: { id: string; name: string }[];
}

export const LeadModal: React.FC<LeadModalProps> = ({
  isOpen,
  onClose,
  onSaveLead,
  initialLead,
  handlers = [],
}) => {
  const [paymentReceipt, setPaymentReceipt] = useState("");
  const [proof, setProof] = useState("");
  const [month, setMonth] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<CallStatus>("Requires Follow-up");
  const [handlerName, setHandlerName] = useState("");
  const [notes, setNotes] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Clear state when modal closes so values never leak into future sessions
      setPaymentReceipt("");
      setProof("");
      setMonth("");
      setFullName("");
      setPhoneNumber("");
      setEmail("");
      setCity("");
      setStatus("Requires Follow-up");
      setHandlerName("");
      setNotes("");
      setManualNotes("");
      return;
    }

    if (initialLead) {
      // Check whether lead is actually assigned or unassigned
      const isActuallyAssigned = Boolean(
        initialLead.handlerName &&
          initialLead.handlerName.trim() !== "" &&
          initialLead.handlerName.toLowerCase() !== "unassigned" &&
          initialLead.handlerName.toLowerCase() !== "none" &&
          initialLead.handlerName.toLowerCase() !== "not assigned" &&
          initialLead.assignmentCategory !== "unassigned"
      );

      setPaymentReceipt(initialLead.paymentReceipt || "");
      setProof(initialLead.proof || "");
      setMonth(initialLead.month || initialLead.lostYearOrMonth || "");
      setFullName(initialLead.fullName || "");
      setPhoneNumber(initialLead.phoneNumber || "");
      setEmail(initialLead.email || "");
      setCity(initialLead.city || "");
      setStatus(initialLead.status || "Requires Follow-up");
      // If unassigned, reset handlerName to empty string so dropdown reliably reflects Unassigned
      setHandlerName(isActuallyAssigned ? (initialLead.handlerName || "") : "");
      setNotes(initialLead.notes || "");
      setManualNotes(initialLead.manualNotes || "");
    } else {
      // Adding new lead - initialize fresh unassigned form
      setPaymentReceipt("REC-" + new Date().getFullYear() + "-001");
      setProof("Bank Slip / Verified");
      setMonth(new Date().toLocaleString("default", { month: "long", year: "numeric" }));
      setFullName("");
      setPhoneNumber("");
      setEmail("");
      setCity("");
      setStatus("Requires Follow-up");
      setHandlerName("");
      setNotes("");
      setManualNotes("");
    }
  }, [initialLead, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isAssigned = Boolean(
      handlerName &&
        handlerName.trim() !== "" &&
        handlerName.toLowerCase() !== "unassigned" &&
        handlerName.toLowerCase() !== "none" &&
        handlerName.toLowerCase() !== "not assigned"
    );
    const matchedHandler = isAssigned
      ? handlers.find(
          (h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()
        )
      : undefined;

    const finalHandlerName = isAssigned ? (matchedHandler?.name || handlerName.trim()) : "";
    const finalHandlerId = isAssigned ? (matchedHandler?.id || initialLead?.handlerId) : undefined;
    const category: "assigned" | "unassigned" = isAssigned ? "assigned" : "unassigned";

    const leadData: Lead = {
      id: initialLead?.id || `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      paymentReceipt: paymentReceipt.trim() || "Pending Receipt",
      proof: proof.trim() || "Verified",
      month: month.trim() || "Not specified",
      lostYearOrMonth: month.trim() || "Not specified",
      fullName: fullName.trim() || "Unnamed Lead",
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      city: city.trim() || "Unknown",
      status,
      handlerName: finalHandlerName,
      handlerId: finalHandlerId,
      assignmentCategory: category,
      assignedAt: isAssigned ? (initialLead?.assignedAt || new Date().toISOString()) : undefined,
      reportDate: isAssigned ? (initialLead?.reportDate || new Date().toISOString().slice(0, 10)) : undefined,
      isPostCutoffRollover: false,
      notes: notes.trim() || "No notes recorded.",
      manualNotes: manualNotes.trim(),
      createdAt: initialLead?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      callCount: initialLead?.callCount || 0,
      lastDialedAt: initialLead?.lastDialedAt,
    };

    onSaveLead(leadData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {initialLead ? "Edit Lead & Payment Record" : "Add New Lead & Payment"}
            </h3>
            <p className="text-xs text-slate-500">
              Payment Receipt, Proof, Month, Full Name, Phone, Email & City
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Full Name & Phone Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Marcus Vance"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                Phone Number (Clickable tel:) *
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 (312) 555-0182"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono font-medium"
              />
            </div>
          </div>

          {/* 2. Email ID & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email ID
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. lead@example.com"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                City *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Chicago, Austin, Denver"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          {/* 3. Payment Receipt & Proof */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                Payment Receipt / Invoice #
              </label>
              <input
                type="text"
                value={paymentReceipt}
                onChange={(e) => setPaymentReceipt(e.target.value)}
                placeholder="e.g. REC-2024-8891 ($1,250.00)"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Proof of Payment / Slip
              </label>
              <input
                type="text"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                placeholder="e.g. Bank Wire Slip / Conf #8812"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          {/* 4. Month & Call Attendance Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Month *
                </label>
                <span className="text-[10px] text-indigo-600 font-medium">Re-editable</span>
              </div>
              <input
                id="modal-input-month"
                type="text"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="e.g. October 2023 or 2024-05"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-800"
              />
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                <span>Quick:</span>
                <button
                  type="button"
                  onClick={() => setMonth(new Date().toLocaleString("default", { month: "long", year: "numeric" }))}
                  className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  This Month
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    setMonth(d.toLocaleString("default", { month: "long", year: "numeric" }));
                  }}
                  className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Last Month
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Call Attendance Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CallStatus)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none cursor-pointer"
              >
                <option value="Requires Follow-up">Requires Follow-up</option>
                <option value="Interested">Interested</option>
                <option value="Pending Call">Pending Call</option>
                <option value="No Answer">No Answer</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
          </div>

          {/* Assigned Handler */}
          {handlers && handlers.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Assigned Team Handler
              </label>
              <select
                id="modal-select-handler"
                value={
                  !handlerName || handlerName.toLowerCase() === "unassigned" || handlerName.toLowerCase() === "none"
                    ? ""
                    : handlerName
                }
                onChange={(e) => setHandlerName(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-slate-900 font-medium cursor-pointer"
              >
                <option value="">Unassigned</option>
                {handlers.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
                {handlerName &&
                  handlerName !== "Unassigned" &&
                  handlerName.toLowerCase() !== "none" &&
                  !handlers.some((h) => h.name.toLowerCase() === handlerName.toLowerCase()) && (
                    <option value={handlerName}>{handlerName}</option>
                  )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Assigned Handler Name
              </label>
              <input
                type="text"
                value={handlerName}
                onChange={(e) => setHandlerName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
              />
            </div>
          )}

          {/* Dedicated Imported Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Imported Notes / Context
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record reason lost, previous discussion, follow-up timeline, or deal notes..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
            />
          </div>

          {/* Additional Column for Manual Notes (Manual Entry for each client) */}
          <div>
            <label className="block text-xs font-semibold text-indigo-900 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Manual Notes (Direct Entry for Client)
              </span>
              <span className="text-[11px] font-normal text-slate-400">Editable directly in table</span>
            </label>
            <textarea
              rows={2}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Type manual notes for this client (e.g. Call outcomes, custom pricing, client requests)..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-indigo-50/20 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
