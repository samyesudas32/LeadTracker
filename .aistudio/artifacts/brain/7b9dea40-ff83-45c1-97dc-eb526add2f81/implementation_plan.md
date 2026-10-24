# Implementation Plan: Interested Clients Dedicated Tab & Weekly/Monthly Completion Reports

Move clients with "Interested" status to a dedicated workspace section tab equipped with payment tracking fields (`paymentDate`, `paymentMethod`, `completionStatus`), and generate interactive Weekly and Monthly reports showing completed clients, payment breakdowns, and assigned team handlers with PDF and Excel export.

---

## 1. Data Model Enhancements (`src/types.ts`)

- Extend `Lead` interface:
  - `paymentDate?: string;` (Format: `YYYY-MM-DD`, defaults to current date on transition)
  - `paymentMethod?: "Card" | "Bank Transfer" | "UPI" | "Cash";`
  - `completionStatus?: "Pending" | "Completed" | "Refunded";`
  - `completedAt?: string;` (ISO timestamp when completion status is set to "Completed")
- Define helper types:
  - `export type PaymentMethod = "Card" | "Bank Transfer" | "UPI" | "Cash";`
  - `export type CompletionStatus = "Pending" | "Completed" | "Refunded";`
- Update `SheetChangeRecord` `changeType` to support `"payment"` and `"completion"` for audit logging.

---

## 2. Dedicated "Interested" Workspace Tab & Filter Logic

- **Tab Schema Update (`src/components/LeadWorkspaceTabs.tsx`)**:
  - Extend `parseWorkspaceTab` and `buildWorkspaceTab` section type to:
    `"main" | "unassigned" | "assigned" | "interested"`
  - Add 4th section pill/card in `LeadWorkspaceTabs`:
    - **Interested Clients Tab**: Displays count badge for interested clients (e.g. `scopeInterestedCount`).
    - Banner/toolbar explaining payment details tracking and completion status.
  - When switching tabs:
    - `currentSection === "interested"` filters leads where `lead.status === "Interested"`.
    - Auto-detect when a lead's status is changed to "Interested", initializing default `paymentDate` (today's date) and `completionStatus` ("Pending") if not already present.

---

## 3. Inline Payment & Completion Editing (`src/components/LeadTable.tsx` & Mobile View)

- When viewing the **Interested Clients** tab (or in expanded lead cards):
  - Add dedicated columns / editable inputs:
    - **Payment Date**: Touch-friendly `<input type="date">` (at least 48px touch target on mobile).
    - **Payment Method**: Select dropdown featuring `Card`, `Bank Transfer`, `UPI`, `Cash`.
    - **Completion Status**: Interactive badge selector for `Pending` (amber), `Completed` (emerald), `Refunded` (rose).
  - Add quick action: One-tap button to mark as "Completed" which immediately updates `completionStatus` to `"Completed"` and sets `completedAt` to current timestamp.
  - Update `src/components/mobile/MobileLeadCard.tsx` and bottom sheets so mobile users can view and edit payment date, method, and completion status seamlessly.

---

## 4. Weekly & Monthly Completion Reports Modal (`src/components/CompletedReportsModal.tsx`)

- **Dedicated Reporting Interface**:
  - Accessible via "Completion Reports" button in the top navigation bar / header and mobile menu.
  - **Period Selectors**:
    - Mode toggle: **Weekly Report** vs. **Monthly Report**.
    - Date selector / week navigator (Current Week, Last Week, Custom Week) and month picker (Current Month, Last Month, Custom Month).
  - **Key Metrics Overview**:
    - Total Completed Clients in Period
    - Total Pending vs. Refunded vs. Completed
    - Payment Method Distribution (Card, Bank Transfer, UPI, Cash)
    - **Assigned Handler Breakdown**: Visual cards showing each handler's count of completed clients (e.g., Helen: 14 completed, Athira: 11 completed, Anjana: 9 completed).
  - **Completed Clients Data Table**:
    - Columns: Client Name, Phone, Email, Assigned Handler, Payment Date, Payment Method, Status, Completed Date.
  - **Export Features**:
    - **Download Excel (.xlsx)**: Generates formatted spreadsheet containing completion metadata, handler names, and payment details.
    - **Download PDF**: Clean, print-ready PDF summary with company header, period range, handler performance table, and detailed client roster.

---

## 5. Verification & Testing

- Validate tab switching across "Main List", "Unassigned List", "Assigned Section", and "Interested Clients".
- Verify that assigning or updating payment date, payment method, and completion status saves to Firestore and syncs in real-time.
- Verify Weekly and Monthly reports compute correct aggregations filtered by `completionStatus === "Completed"` and `paymentDate` / `completedAt`.
- Test Excel and PDF exports from the Completed Reports modal.
- Run `lint_applet` and `compile_applet` to ensure zero compilation or lint errors.
