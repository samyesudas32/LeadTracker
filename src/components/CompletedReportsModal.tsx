import React, { useState, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Lead, HandlerRecord } from "../types";
import { getLocalDateString } from "../utils/dateUtils";
import { getLeadHandlerName } from "../utils/pdfGenerator";
import { getHandlerColorClasses } from "../data/handlerDefaults";

export interface CompletedReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  handlers: HandlerRecord[];
  companyName?: string;
  softwareTitle?: string;
}

type ReportPeriodMode = "weekly" | "monthly";

interface WeekRange {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

function getWeekRanges(): WeekRange[] {
  const today = new Date();
  const ranges: WeekRange[] = [];

  // Generate 8 week options: Current week, and 7 previous weeks
  for (let i = 0; i < 8; i++) {
    const ref = new Date(today);
    ref.setDate(today.getDate() - i * 7);

    // Calculate Monday of that week
    const day = ref.getDay();
    const diffToMonday = ref.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ref.setDate(diffToMonday));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startStr = monday.toISOString().slice(0, 10);
    const endStr = sunday.toISOString().slice(0, 10);

    const label =
      i === 0
        ? `This Week (${startStr} to ${endStr})`
        : i === 1
        ? `Last Week (${startStr} to ${endStr})`
        : `${i} Weeks Ago (${startStr} to ${endStr})`;

    ranges.push({ label, startDate: startStr, endDate: endStr });
  }

  return ranges;
}

function getMonthRanges(): { label: string; yearMonth: string }[] {
  const today = new Date();
  const months: { label: string; yearMonth: string }[] = [];

  // Last 12 months
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    months.push({ label, yearMonth });
  }

  return months;
}

export const CompletedReportsModal: React.FC<CompletedReportsModalProps> = ({
  isOpen,
  onClose,
  leads,
  handlers,
  companyName = "Enterprise Sales Operations",
  softwareTitle = "Lead & Payment Tracker",
}) => {
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>("weekly");

  const weekRanges = useMemo(() => getWeekRanges(), []);
  const monthRanges = useMemo(() => getMonthRanges(), []);

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);
  const [selectedHandlerFilter, setSelectedHandlerFilter] = useState<string>("all");

  const currentWeek = weekRanges[selectedWeekIdx] || weekRanges[0];
  const currentMonth = monthRanges[selectedMonthIdx] || monthRanges[0];

  // Completed leads filter
  const completedLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Must be marked as Completed (or status Interested + completionStatus === Completed)
      const isCompleted = lead.completionStatus === "Completed";
      if (!isCompleted) return false;

      // Filter by period date (paymentDate, completedAt, reportDate, or uploadDate)
      const dateToCheck =
        lead.paymentDate ||
        lead.completedAt?.slice(0, 10) ||
        lead.reportDate ||
        lead.uploadDate ||
        lead.createdAt?.slice(0, 10);

      if (!dateToCheck) return false;

      if (periodMode === "weekly") {
        if (dateToCheck < currentWeek.startDate || dateToCheck > currentWeek.endDate) {
          return false;
        }
      } else {
        if (!dateToCheck.startsWith(currentMonth.yearMonth)) {
          return false;
        }
      }

      // Handler filter
      if (selectedHandlerFilter !== "all") {
        const hName = getLeadHandlerName(lead, handlers) || lead.handlerName || "";
        if (hName.toLowerCase() !== selectedHandlerFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [
    leads,
    handlers,
    periodMode,
    currentWeek,
    currentMonth,
    selectedHandlerFilter,
  ]);

  // Breakdown by handler
  const handlerBreakdown = useMemo(() => {
    const map: Record<string, { count: number; paymentMethods: Record<string, number> }> = {};

    completedLeads.forEach((l) => {
      const hName = getLeadHandlerName(l, handlers) || l.handlerName || "Unassigned";
      if (!map[hName]) {
        map[hName] = { count: 0, paymentMethods: {} };
      }
      map[hName].count += 1;
      const method = l.paymentMethod || "Not Specified";
      map[hName].paymentMethods[method] = (map[hName].paymentMethods[method] || 0) + 1;
    });

    return map;
  }, [completedLeads, handlers]);

  // Breakdown by payment method
  const paymentMethodBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Card: 0,
      "Bank Transfer": 0,
      UPI: 0,
      Cash: 0,
      Other: 0,
    };

    completedLeads.forEach((l) => {
      const m = l.paymentMethod || "";
      if (m === "Card" || m === "Bank Transfer" || m === "UPI" || m === "Cash") {
        counts[m] += 1;
      } else {
        counts["Other"] += 1;
      }
    });

    return counts;
  }, [completedLeads]);

  // Active period display string
  const activePeriodLabel = useMemo(() => {
    if (periodMode === "weekly") {
      return `Weekly: ${currentWeek.startDate} to ${currentWeek.endDate}`;
    }
    return `Monthly: ${currentMonth.label}`;
  }, [periodMode, currentWeek, currentMonth]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Detailed Completed Clients Roster
      const rosterRows = completedLeads.map((l, idx) => ({
        "No.": idx + 1,
        "Client Name": l.fullName,
        "Phone Number": l.phoneNumber,
        "Email ID": l.email,
        "City": l.city || "",
        "Assigned Handler": getLeadHandlerName(l, handlers) || l.handlerName || "Unassigned",
        "Payment Date": l.paymentDate || "",
        "Payment Method": l.paymentMethod || "Card",
        "Completion Status": l.completionStatus || "Completed",
        "Call Status": l.status,
        "Completed At": l.completedAt ? l.completedAt.slice(0, 19).replace("T", " ") : "",
        "Notes": l.manualNotes || l.notes || "",
      }));

      const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
      XLSX.utils.book_append_sheet(wb, wsRoster, "Completed Clients");

      // Sheet 2: Handler Performance Breakdown
      const handlerRows = Object.entries(handlerBreakdown).map(([hName, data]) => ({
        "Handler Name": hName,
        "Completed Clients Count": data.count,
        "Card Payments": data.paymentMethods["Card"] || 0,
        "Bank Transfer Payments": data.paymentMethods["Bank Transfer"] || 0,
        "UPI Payments": data.paymentMethods["UPI"] || 0,
        "Cash Payments": data.paymentMethods["Cash"] || 0,
      }));

      const wsHandlers = XLSX.utils.json_to_sheet(handlerRows);
      XLSX.utils.book_append_sheet(wb, wsHandlers, "Handler Performance");

      const filePeriodSlug = periodMode === "weekly"
        ? `Week_${currentWeek.startDate}_to_${currentWeek.endDate}`
        : `Month_${currentMonth.yearMonth}`;

      XLSX.writeFile(wb, `Completed_Clients_Report_${filePeriodSlug}.xlsx`);
    } catch (err) {
      console.error("Failed to export Excel report:", err);
    }
  };

  // Export to PDF
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Brand Header
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 297, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${softwareTitle} — Completion & Payment Report`, 14, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `${companyName} • Period: ${activePeriodLabel} • Generated: ${new Date().toLocaleString()}`,
        14,
        18
      );

      // Summary KPI banner
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Executive Summary & Team Metrics", 14, 32);

      const summaryTableData = [
        [
          "Total Completed Clients",
          `${completedLeads.length}`,
          "Active Handlers",
          `${Object.keys(handlerBreakdown).length}`,
          "Payment Breakdown",
          `Card: ${paymentMethodBreakdown.Card} | Bank: ${paymentMethodBreakdown["Bank Transfer"]} | UPI: ${paymentMethodBreakdown.UPI} | Cash: ${paymentMethodBreakdown.Cash}`,
        ],
      ];

      autoTable(doc, {
        startY: 35,
        head: [["Metric", "Value", "Metric", "Value", "Methods Distribution", "Details"]],
        body: summaryTableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      });

      // Handler Performance Table
      const handlerTableStartY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Completed Clients Breakdown by Assigned Handler", 14, handlerTableStartY);

      const handlerTableRows = Object.entries(handlerBreakdown).map(([hName, d]) => [
        hName,
        `${d.count}`,
        `${d.paymentMethods["Card"] || 0}`,
        `${d.paymentMethods["Bank Transfer"] || 0}`,
        `${d.paymentMethods["UPI"] || 0}`,
        `${d.paymentMethods["Cash"] || 0}`,
        `${completedLeads.length > 0 ? Math.round((d.count / completedLeads.length) * 100) : 0}%`,
      ]);

      autoTable(doc, {
        startY: handlerTableStartY + 2,
        head: [["Assigned Handler", "Completed Clients", "Card", "Bank Transfer", "UPI", "Cash", "% of Total"]],
        body: handlerTableRows,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      });

      // Detailed Client Roster Table
      const rosterTableStartY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Individual Completed Client Records", 14, rosterTableStartY);

      const rosterTableRows = completedLeads.map((l, idx) => [
        `${idx + 1}`,
        l.fullName,
        l.phoneNumber,
        l.email || "—",
        getLeadHandlerName(l, handlers) || l.handlerName || "Unassigned",
        l.paymentDate || "—",
        l.paymentMethod || "Card",
        l.completionStatus || "Completed",
        l.city || "—",
      ]);

      autoTable(doc, {
        startY: rosterTableStartY + 2,
        head: [["#", "Client Name", "Phone", "Email", "Assigned Handler", "Payment Date", "Method", "Status", "City"]],
        body: rosterTableRows,
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      });

      const filePeriodSlug = periodMode === "weekly"
        ? `Week_${currentWeek.startDate}_to_${currentWeek.endDate}`
        : `Month_${currentMonth.yearMonth}`;

      doc.save(`Completed_Clients_Report_${filePeriodSlug}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF report:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-completed-reports-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="modal-completed-reports-container"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Completed Clients & Performance Reports
                </h2>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-2xs">
                  Live Analytics
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Weekly & monthly breakdown of completed client acquisitions, payment methods, and assigned handler performance.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-completed-reports-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Reports Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Subheader Controls & Period Selectors */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Period Mode Toggle (Weekly vs Monthly) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                id="btn-toggle-weekly-report"
                onClick={() => setPeriodMode("weekly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodMode === "weekly"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Weekly Report</span>
              </button>
              <button
                type="button"
                id="btn-toggle-monthly-report"
                onClick={() => setPeriodMode("monthly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodMode === "monthly"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Monthly Report</span>
              </button>
            </div>

            {/* Time Period Selector */}
            {periodMode === "weekly" ? (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-600">Select Week:</span>
                <select
                  id="select-report-week"
                  value={selectedWeekIdx}
                  onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
                >
                  {weekRanges.map((w, idx) => (
                    <option key={w.startDate} value={idx}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-600">Select Month:</span>
                <select
                  id="select-report-month"
                  value={selectedMonthIdx}
                  onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
                >
                  {monthRanges.map((m, idx) => (
                    <option key={m.yearMonth} value={idx}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Handler Filter */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
              <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-semibold text-slate-600">Filter Handler:</span>
              <select
                id="select-report-handler"
                value={selectedHandlerFilter}
                onChange={(e) => setSelectedHandlerFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
              >
                <option value="all">All Handlers</option>
                {handlers.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              id="btn-export-completed-excel"
              onClick={handleExportExcel}
              disabled={completedLeads.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Download completed clients report as Excel workbook (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              id="btn-export-completed-pdf"
              onClick={handleExportPdf}
              disabled={completedLeads.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Download formatted executive PDF report"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Total Completed */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Completed Clients
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-emerald-950 tabular-nums">
                  {completedLeads.length}
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  in {periodMode === "weekly" ? "selected week" : "selected month"}
                </span>
              </div>
            </div>

            {/* Card 2: Active Handlers with Completions */}
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">
                Active Handlers
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-indigo-950 tabular-nums">
                  {Object.keys(handlerBreakdown).length}
                </span>
                <span className="text-xs font-semibold text-indigo-700">team members</span>
              </div>
            </div>

            {/* Card 3: Top Payment Method */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Payment Distribution
              </span>
              <div className="text-xs font-bold text-slate-800 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Card:</span>
                  <span className="tabular-nums font-extrabold">{paymentMethodBreakdown.Card}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Transfer:</span>
                  <span className="tabular-nums font-extrabold">
                    {paymentMethodBreakdown["Bank Transfer"]}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: UPI & Cash */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                UPI & Cash Methods
              </span>
              <div className="text-xs font-bold text-slate-800 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">UPI:</span>
                  <span className="tabular-nums font-extrabold">{paymentMethodBreakdown.UPI}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash:</span>
                  <span className="tabular-nums font-extrabold">{paymentMethodBreakdown.Cash}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Handler Breakdown Cards */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Completed Clients by Assigned Handler
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Period: <strong className="text-slate-800">{activePeriodLabel}</strong>
              </span>
            </div>

            {Object.keys(handlerBreakdown).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No completed clients in this period</p>
                <p className="text-slate-400 mt-0.5">
                  Clients must be marked as "Completed" in the Interested Clients tab with a matching payment date.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(handlerBreakdown).map(([hName, data]) => {
                  const hRecord = handlers.find(
                    (h) => h.name.toLowerCase() === hName.toLowerCase()
                  );
                  const colorCls = getHandlerColorClasses(hRecord?.color);
                  const percent = completedLeads.length > 0
                    ? Math.round((data.count / completedLeads.length) * 100)
                    : 0;

                  return (
                    <div
                      key={hName}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${colorCls.dot} shadow-2xs`}
                          />
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {hName}
                          </span>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 tabular-nums">
                          {data.count} {data.count === 1 ? "Client" : "Clients"}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                        <span>Share of total: {percent}%</span>
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          {data.paymentMethods["Card"] ? <span>Card:{data.paymentMethods["Card"]}</span> : null}
                          {data.paymentMethods["Bank Transfer"] ? <span>Bank:{data.paymentMethods["Bank Transfer"]}</span> : null}
                          {data.paymentMethods["UPI"] ? <span>UPI:{data.paymentMethods["UPI"]}</span> : null}
                          {data.paymentMethods["Cash"] ? <span>Cash:{data.paymentMethods["Cash"]}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Detailed Client Roster Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Completed Clients List ({completedLeads.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Sorted by latest payment date
              </span>
            </div>

            {completedLeads.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No records found</p>
                <p className="text-slate-400 mt-0.5">
                  Try switching the week or month filter, or setting a client to "Completed" in the workspace.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px] text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Client Name</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Assigned Handler</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3">Payment Method</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedLeads.map((lead, idx) => {
                      const hName = getLeadHandlerName(lead, handlers) || lead.handlerName || "Unassigned";
                      const hRecord = handlers.find(
                        (h) => h.name.toLowerCase() === hName.toLowerCase()
                      );
                      const colorCls = getHandlerColorClasses(hRecord?.color);

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {lead.fullName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            <a
                              href={`tel:${lead.phoneNumber}`}
                              className="text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {lead.phoneNumber}
                            </a>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {lead.email || "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${colorCls.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${colorCls.dot}`} />
                              <span>{hName}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 tabular-nums">
                            {lead.paymentDate || "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {lead.paymentMethod || "Card"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Completed</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Total: <strong className="text-slate-800 font-bold">{completedLeads.length}</strong> completed clients in {activePeriodLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
