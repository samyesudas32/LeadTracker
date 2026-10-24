import React, { useState } from "react";
import {
  Phone,
  CheckCircle2,
  AlertCircle,
  PhoneMissed,
  PhoneOff,
  X,
  Save,
  Lightbulb,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  UserCheck,
} from "lucide-react";
import { Lead, CallStatus } from "../types";
import { formatTelLink } from "../utils/parser";
import { getClientCallHandlingGuide } from "../utils/callGuide";

interface CallLogModalProps {
  lead: Lead | null;
  onClose: () => void;
  onSaveCallLog: (leadId: string, status: CallStatus, noteToAdd: string) => void;
  quickPresets?: string[];
  handlerName?: string;
}

export const CallLogModal: React.FC<CallLogModalProps> = ({
  lead,
  onClose,
  onSaveCallLog,
  quickPresets = [
    "Left voicemail; callback requested",
    "Customer busy, requested call tomorrow morning",
    "Confirmed payment details and sent receipt",
    "Interested in pricing offer, requested WhatsApp",
    "Phone rang with no answer",
  ],
  handlerName,
}) => {
  if (!lead) return null;

  const isAssigned = Boolean(
    (handlerName && handlerName.trim() !== "" && handlerName.toLowerCase() !== "unassigned") ||
    (lead.handlerName && lead.handlerName.trim() !== "" && lead.handlerName.toLowerCase() !== "unassigned" && lead.assignmentCategory !== "unassigned")
  );
  const effectiveHandler = isAssigned ? (handlerName || lead.handlerName || "") : "";
  const guide = getClientCallHandlingGuide(lead, effectiveHandler || "Handler");

  const [selectedStatus, setSelectedStatus] = useState<CallStatus>(
    lead.status === "Pending Call" ? "Interested" : lead.status
  );
  const [newNote, setNewNote] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleCopyScript = () => {
    navigator.clipboard?.writeText(guide.openingScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDialNow = () => {
    const telUri = formatTelLink(lead.phoneNumber);
    if (telUri) {
      window.location.href = telUri;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCallLog(lead.id, selectedStatus, newNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Call & Log Lead</h3>
              <p className="text-xs text-slate-500">Record attendance, review script, and update notes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Contact summary card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-slate-900 block">{lead.fullName}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{lead.city || "Unknown City"}</span>
                  <span>•</span>
                  <span>Month: {lead.month || lead.lostYearOrMonth}</span>
                  {lead.paymentReceipt && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-slate-700 font-semibold flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-emerald-600" />
                        {lead.paymentReceipt}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  Calls: {lead.callCount || 0}
                </span>
                {effectiveHandler ? (
                  <span className="text-[10px] font-semibold text-indigo-700 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    <UserCheck className="w-2.5 h-2.5" /> {effectiveHandler}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Unassigned
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
              <a
                href={formatTelLink(lead.phoneNumber)}
                onClick={handleDialNow}
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
              >
                <Phone className="w-3.5 h-3.5" />
                {lead.phoneNumber || "No phone number"}
              </a>
              <button
                type="button"
                onClick={handleDialNow}
                disabled={!lead.phoneNumber}
                className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Dial Phone
              </button>
            </div>
          </div>

          {/* How to Handle This Call Card */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-bold text-indigo-950 hover:bg-indigo-100/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                How to Handle this Call (Client Playbook)
              </span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5 text-indigo-700" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-700" />}
            </button>

            {showGuide && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-2 text-xs border-t border-indigo-100">
                <div className="text-indigo-900 font-medium">
                  <span className="font-bold">Objective:</span> {guide.objective}
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 font-mono text-[11px] text-slate-800 relative">
                  <div className="flex items-center justify-between mb-1 font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Opening Script</span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                      {copiedScript ? "Copied" : "Copy"}
                    </button>
                  </div>
                  "{guide.openingScript}"
                </div>

                <ul className="space-y-1 text-[11px] text-slate-700">
                  {guide.talkingPoints.slice(0, 2).map((tp, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{tp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Call Outcome Status Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Update Call Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStatus("Interested")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  selectedStatus === "Interested"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-400"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Interested
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus("Requires Follow-up")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  selectedStatus === "Requires Follow-up"
                    ? "bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-400"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Requires Follow-up
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus("No Answer")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  selectedStatus === "No Answer"
                    ? "bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-400"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <PhoneMissed className="w-4 h-4 text-rose-600 shrink-0" />
                No Answer
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus("Not Interested")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  selectedStatus === "Not Interested"
                    ? "bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-400"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <PhoneOff className="w-4 h-4 text-slate-500 shrink-0" />
                Not Interested
              </button>
            </div>
          </div>

          {/* Quick Note Presets */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Quick Note Presets (Click to insert)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewNote((prev) => (prev ? `${prev}; ${preset}` : preset))}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Call Notes input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Add Call Log Note
            </label>
            <textarea
              id="textarea-call-log-note"
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Discussed pricing; customer requested a callback on Monday..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 outline-none text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Call Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
