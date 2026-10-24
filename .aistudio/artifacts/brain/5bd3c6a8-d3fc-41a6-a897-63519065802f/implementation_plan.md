# Implementation Plan: Custom Workspace Color Accent

Support custom color accents for Workspace Pages in addition to the preset color palette. Users can pick arbitrary colors using a native color swatch picker or enter a 6-character `#HEX` code during workspace page creation, duplication, or renaming. The chosen custom color will dynamically tint the workspace tab indicator dot, active border accent, and lead count badge across the top navigation bar and directory overview.

---

## 1. User Intent & Confirmed Specifications
Based on the clarifying questions:
1. **Picker Presentation**: A dedicated **"Custom"** color swatch option in `PageModal.tsx` containing:
   - A clickable color swatch preview that triggers the browser's native `<input type="color">` picker.
   - An inline `#HEX` text input (with automatic uppercase formatting, `#` prefix normalization, and validation).
   - An active selection checkmark and live preview swatch.
2. **Visual Accent Targets**:
   - **Tab Indicator Dot**: Styled with the custom hex background color (e.g. `style={{ backgroundColor: page.customColor }}`).
   - **Active Tab Border Accent**: Highlighted with the custom hex color on the active workspace tab border.
   - **Lead Count Badge**: Displays the count inside a pill tinted with the custom workspace accent.
   - **Directory Quick Jump Dropdown**: Uses the custom dot and active item styling.

---

## 2. Architecture & Data Model Changes

### `src/types.ts`
- Enhance `WorkspacePage`:
  ```typescript
  export interface WorkspacePage {
    id: string;
    name: string;
    description?: string;
    color?: "indigo" | "blue" | "emerald" | "purple" | "rose" | "amber" | "teal" | "slate";
    customColor?: string; // Optional custom hex string e.g. "#8B5CF6" or "#0ea5e9"
    isDefault?: boolean;
    order?: number;
    createdAt: string;
    updatedAt: string;
  }
  ```
- Retain `color` for backward compatibility with presets and fallback logic. When `customColor` is set, it takes visual precedence over `color`.

### `src/utils/pageManager.ts`
- Update `createBlankPage`:
  - Accept `customColor?: string` parameter.
  - Return `newPage` with `customColor` assigned.
- Update `duplicateWorkspacePage`:
  - Accept optional `color` and `customColor` overrides.
  - Preserve `sourcePage.customColor` on the duplicated page when cloning.
- Update `loadWorkspacePages`:
  - Preserve existing `customColor` values parsed from `localStorage`.
- Add color helper functions:
  - `isValidHexColor(hex: string): boolean` (validates `#RRGGBB` or `#RGB`).
  - `getWorkspaceColorStyles(page: WorkspacePage, isActive: boolean)`: returns computed inline styles and classNames for dot, border, and badge.

---

## 3. Component Updates

### `src/components/PageModal.tsx`
- **State Management**:
  - Add `customColor` state (`string`, initialized to `#6366F1` or existing `effectivePage.customColor`).
  - Add `isCustomColorActive` boolean flag (true when user chooses the Custom swatch or edits the HEX input).
- **Custom Color Swatch & Native Picker**:
  - Add a **"Custom"** button alongside the standard 8 preset chips (`Indigo`, `Blue`, `Emerald`, etc.).
  - Hidden `<input type="color" ref={colorInputRef} value={customColor} onChange={...} />`.
  - Visible swatch element showing current hex with an eye-dropper icon.
  - `#HEX` text input:
    - Auto-enforces uppercase `#` prefix.
    - Live validates against 3 or 6 hex digits.
    - Updates swatch and triggers state update instantly.
- **Callbacks**:
  - Pass `customColor: isCustomColorActive ? customColor : undefined` to `onCreateBlank`, `onDuplicatePage`, and `onRenamePage`.

### `src/components/PageNavigationTabs.tsx`
- **Dynamic Accent Styling**:
  - When `page.customColor` is present:
    - **Tab Dot**: `style={{ backgroundColor: page.customColor }}` (with soft glow ring when active: `boxShadow: '0 0 0 2px ' + page.customColor + '40'`).
    - **Active Tab Border**: `style={{ borderColor: page.customColor }}`.
    - **Count Badge**:
      - Active: `style={{ backgroundColor: page.customColor, color: '#FFFFFF' }}`.
      - Inactive: subtle muted styling with neutral background or tinted border.
    - **Directory Dropdown Dot & Selected Highlight**: `style={{ backgroundColor: page.customColor }}`.
  - When `page.customColor` is omitted:
    - Seamlessly falls back to the existing Tailwind preset classes (`getColorClass(page.color)`).

### `src/App.tsx`
- Update handlers (`handleCreateBlankPage`, `handleDuplicatePage`, `handleRenamePage`) to accept and store `customColor?: string`.
- Persist `customColor` to localStorage and Firestore.

### `firestore.rules`
- Validate `customColor` within `isValidPage(data)`:
  ```javascript
  function isValidPage(data) {
    return (!('id' in data) || (data.id is string && data.id.size() <= 128)) &&
           (!('name' in data) || (data.name is string && data.name.size() <= 150)) &&
           (!('createdAt' in data) || (data.createdAt is string && data.createdAt.size() <= 100)) &&
           (!('customColor' in data) || (data.customColor is string && data.customColor.size() <= 32));
  }
  ```
- Deploy updated security rules via `deploy_firebase`.

---

## 4. Verification & Testing Plan

1. **Preset Compatibility**:
   - Verify existing workspaces with preset colors (`indigo`, `blue`, `emerald`, etc.) continue to render correctly without regression.
2. **Custom Color Creation**:
   - Open "+ New Page" modal, select "Custom", pick a vibrant color (e.g., `#E11D48` crimson or `#0D9488` teal) using native picker and manual HEX input.
   - Confirm active tab dot, active border, and lead count badge match the custom color.
3. **Workspace Duplication**:
   - Duplicate an existing workspace page that has a custom color accent.
   - Verify the cloned workspace inherits or allows re-assigning a new custom color.
4. **Workspace Renaming / Editing**:
   - Use the workspace tab dropdown menu ("Rename Workspace") to switch between preset colors and custom hex colors.
   - Confirm immediate UI update and persistence.
5. **Persistence & Firestore Sync**:
   - Refresh page to verify localStorage persistence.
   - Check Firestore rule evaluation to ensure no permission denied errors occur when saving `customColor`.
6. **Code Quality**:
   - Run `compile_applet` and `lint_applet` to guarantee 0 TypeScript and lint errors.
