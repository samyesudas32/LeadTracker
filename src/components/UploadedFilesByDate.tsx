import React from "react";
import { UploadedFileRecord, Lead } from "../types";
import { DateTabNavigation } from "./DateTabNavigation";

export interface UploadedFilesByDateProps {
  files: UploadedFileRecord[];
  leads?: Lead[];
  activeDateFilter: string; // "all" or specific YYYY-MM-DD
  activeFileFilter: string; // "all" or specific fileId
  onSelectDateFilter: (dateStr: string) => void;
  onSelectFileFilter: (fileId: string) => void;
  onDeleteFile: (file: UploadedFileRecord) => void;
  onExportFileLeads?: (file: UploadedFileRecord) => void;
  onQuickUploadForDate?: (dateStr: string) => void;
  onQuickUploadForTomorrow?: () => void;
  onOpenPdfReport?: (dateStr?: string) => void;
}

export const UploadedFilesByDate: React.FC<UploadedFilesByDateProps> = ({
  files,
  leads = [],
  activeDateFilter,
  activeFileFilter,
  onSelectDateFilter,
  onSelectFileFilter,
  onDeleteFile,
  onExportFileLeads,
  onQuickUploadForDate,
  onQuickUploadForTomorrow,
  onOpenPdfReport,
}) => {
  return (
    <DateTabNavigation
      files={files}
      leads={leads}
      activeDateFilter={activeDateFilter}
      activeFileFilter={activeFileFilter}
      onSelectDateFilter={onSelectDateFilter}
      onSelectFileFilter={onSelectFileFilter}
      onDeleteFile={onDeleteFile}
      onExportFileLeads={onExportFileLeads}
      onQuickUploadForDate={onQuickUploadForDate}
      onQuickUploadForTomorrow={onQuickUploadForTomorrow}
      onOpenPdfReport={onOpenPdfReport}
    />
  );
};

export default UploadedFilesByDate;
