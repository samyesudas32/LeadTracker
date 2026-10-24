# Implementation Plan - Session Persistence, Handler Unassignment Reset & Client Search Button

Fix the handler assignment state persistence bug, ensure unassigned clients display a clean Unassigned badge with empty handler name (clearing any cached/stale handler data and fetching current state from database on initialization), persist the user's workspace session across reloads (active file sheet, tab view, filters, search query), and add a dedicated Search button beside the search input in the Main List.

## Proposed Changes

### 1. Handler Unassignment Reset & Clean Database Hydration
- **Clear Handler Data on Unassignment**:
  - In `src/App.tsx` (`handleUpdateHandler`, batch assign, auto-distribute) and `src/components/LeadModal.tsx`:
    - When a handler is removed or set to unassigned, set `handlerName: ""` (empty string) and `handlerId: undefined` (or null in API patch), removing any previous handler name.
  - In `server.ts` (`/api/leads/:id`):
    - When `isUnassigning` is true, explicitly set `dbStore.leads[index].handlerName = ""` and `dbStore.leads[index].assignmentCategory = "unassigned"`, removing `handlerId`, `assignedAt`, and `reportDate`.
  - In `src/services/firebase.ts` (Firestore synchronization):
    - Ensure unassigned sync payloads clear `handlerName` to `""` and remove `handlerId`.
- **Database Initialization & Fetch Sanitization**:
  - In `src/App.tsx` (both initial local storage hydration and server `/api/leads` fetch):
    - Re-evaluate each lead: if not actively assigned (`!item.handlerName || item.handlerName === "Unassigned" || item.assignmentCategory === "unassigned"`), reset `handlerName` to `""` and `handlerId` to `undefined`.
    - Ensure fresh database assignment state overrides any stale local handler cache.

### 2. Table Handler Display: Clean Unassigned Badge
- **In `src/components/LeadTable.tsx`**:
  - Update row handler rendering:
    - If lead is unassigned: show a distinctive, clean **Unassigned** badge with a subtle dash/empty handler text rather than a stale handler name.
    - Provide a clean selector/action allowing managers/staff to assign a handler directly from the dropdown, defaulting the selected value to `""` ("Unassigned (Queue)").
    - Prevent fallback to any previously cached handler name when unassigned.
  - Maintain quick assignment dropdown for authenticated users with permission while displaying the clean visual status badge.

### 3. Work Session State Persistence
- **Workspace Session Storage Key**: Define `LEAD_TRACKER_SESSION_STATE_KEY = "lead_tracker_session_state_v1"`.
- **Session Elements to Persist**:
  1. **Active File Sheet**: `activeFileFilter` (e.g. specific uploaded file or "all").
  2. **Active Tab View**: `activeWorkspaceTab` (e.g., "all", "assigned", "unassigned", or file-specific tabs).
  3. **Filters**: `statusFilter`, `selectedYear`, `selectedCity`, `selectedHandler`, `sortBy`.
  4. **Search Query**: `searchQuery`.
- **Lifecycle in `src/App.tsx`**:
  - Initialize states from `localStorage.getItem(LEAD_TRACKER_SESSION_STATE_KEY)` on load.
  - Automatically save changes with debounced or immediate effect so users seamlessly resume exactly where they left off the next day.
  - Add a subtle "Session Restored" indicator or quick "Reset View" option in the filter toolbar when returning to a restored session.

### 4. Dedicated "Search Button" Beside Client Search Input
- **In `src/components/LeadFilters.tsx`**:
  - Add a dedicated, styled **Search** button immediately adjacent to the client search input.
  - Features:
    - Clear icon (`Search`) and "Search" label.
    - Clicking the button or pressing `Enter` triggers immediate search filtering, focuses the search input, and scrolls or highlights the matching leads in the Main List.
    - Seamlessly works with the existing quick-clear `X` button and `/` shortcut key.
    - Responsive layout ensuring elegant display across desktop and mobile screens.

## Verification Plan

### Automated Checks
- Run `compile_applet` to confirm zero TypeScript compilation errors.
- Run `lint_applet` to ensure ESLint compliance.
- Test server API health and `/api/leads/:id` unassignment endpoint.

### Manual Verification
1. **Unassign Handler Test**:
   - Assign a handler to a client lead, then select "Unassigned (Queue)" or clear handler.
   - Verify that the table immediately displays the clean Unassigned badge with an empty handler name.
   - Reload the browser page or start a new session: verify the client remains unassigned with no residual previous handler name displayed.
2. **Session Persistence Test**:
   - Select a specific uploaded file tab, set a status filter (e.g., "Interested"), a city filter, and type a client name in the search input.
   - Refresh the page: verify that the exact active file tab, filters, and search query are preserved and rehydrated.
3. **Dedicated Search Button Test**:
   - Type a client name into the search bar and click the new dedicated "Search" button.
   - Verify search execution, matching rows count, and clear functionality.
