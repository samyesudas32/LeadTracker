# Unified Credential Governance & Role-Based Authentication System

Comprehensive integration plan to link Customer / Client Sign-In, Staff, Manager, and Super Admin Console authentication, enabling full self-service User ID and Password modifications with real-time synchronization to login modals and demo helpers, plus a dedicated Customer view-only role.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on your requirements:
> - **Unified Credential Management Location**: User IDs and passwords for all roles (Super Admin, Manager, Staff, and Customer) will be manageable directly within the **Super Admin Console** and the **Workspace Settings / RBAC tab**.
> - **Live Demo Accounts Display**: The "Available Demo Accounts" helper inside the Customer & Client login modal will dynamically reflect the **currently active, updated User IDs and passwords** instead of static hardcoded text.
> - **Dedicated Customer Role**: When signing in with Customer credentials, users enter a tailored, **view-only workspace mode** with lead inspection and report generation, preventing accidental edits or deletions.

---

## 1. Overview & Core Concept

Currently, the Customer & Client Login modal displays hardcoded sample credentials (`admin / Sam@1997` and `staff / Staff@123`), and credential updates made in one area of the app do not propagate across all login gateways (Landing Page, Super Admin Console, and Main Login Screen).

This upgrade establishes a centralized, reactive credential governance service:
- **Centralized Credential Store**: Persists credentials for **Super Admin**, **Manager**, **Staff**, and **Customer / Client** in server state (`data/db.json`) and synchronized client storage.
- **Dynamic Login Modals**: The Customer & Client Login popup and main login screen query live credentials to display updated demo badges, quick-fill helpers, and authenticate against the latest passwords.
- **Dedicated Customer Role**: Adds a `"customer"` role to the RBAC matrix with safe, read-only permissions and distinct UI badging.
- **Multi-Role Credential Editor**: Provides intuitive editors in both the Super Admin Console ("Credential Center") and Workspace Settings to change usernames, passwords, and recovery emails with 1-click test fill.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Customer / Client Sign-In**:
   - User clicks **"Customer / Client Sign-In"** or **"Customer Login"** on the Landing Page.
   - The modal appears with live demo badges:
     - 👤 **Customer**: `client` / `Client@123` (or custom updated values)
     - 👑 **Manager**: Dynamic active manager ID & password
     - 👥 **Staff**: Dynamic active staff ID & password
   - Clicking any demo badge automatically fills the User ID and Password fields.
   - Submitting Customer credentials launches the Workspace directly into **Customer View-Only Mode** (banner: *"Customer Portal · View Only"*).

2. **Super Admin Console Authentication & Management**:
   - User clicks **"Super Admin Console"** on the landing page or navigates to `?portal=super_admin`.
   - Authenticates using current Super Admin credentials (or updated Manager master credentials).
   - In the Super Admin Portal, a new **"Credential Governance"** tab allows viewing and editing:
     - **Super Admin**: Username & Password
     - **Manager Account**: Username & Password
     - **Staff Specialists**: Usernames & Passwords
     - **Customer Accounts**: Usernames & Passwords
   - Changes take effect immediately across all connected browser tabs via WebSocket / SSE broadcast.

3. **Workspace Settings Credential Management**:
   - In Workspace Settings (`AccountSettingsModal` and `RbacSettingsTab`), Managers can update their own User ID and Password, manage Staff accounts, and configure Customer access passwords.

### Visual Identity & Theme
- **Color Discipline**:
  - Dominant Canvas: Clean Slate Neutral (`#0F172A` for consoles/headers, `#F8FAFC` for dashboard surfaces).
  - Accents: Emerald (`#059669`) for Verified/Active status and primary buttons; Indigo (`#4F46E5`) for Manager/Admin credentials; Amber (`#D97706`) for View-Only Customer notices.
- **Typography & Formatting**:
  - Headings: `Plus Jakarta Sans` with balanced line wrapping.
  - Credentials & Codes: Tabular monospace font (`JetBrains Mono`, `tabular-nums`) for User IDs, passwords, and 6-digit OTP codes.
- **Anti-Slop Discipline**:
  - Clean unboxed metadata with `·` separators; no static pill enclosures.
  - Single-line buttons with clear, professional labels (`"Update Password"`, `"Sign In"`, `"Quick Fill"`).

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-offs |
| :--- | :--- | :--- |
| **Credential Synchronization** | Hybrid API + SSE/WebSocket broadcast with LocalStorage fallback | Guarantees instant real-time synchronization across browser tabs without requiring full page reload, while remaining functional offline. |
| **Demo Account Badging** | Dynamic badge component reading current store | Avoids user frustration where changed passwords break demo buttons or leave outdated instructions in the popup. |
| **Customer Role Scope** | Dedicated `customer` role with `view_only` permissions | Meets security best practices by preventing external clients from modifying assignment data or purging records. |
| **Super Admin Password Storage** | Server-backed persistent JSON (`dbStore.superAdminCredentials`) | Allows Super Admins to rotate passwords safely without hardcoded repository leaks or manual database restarts. |

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Unified Auth Architecture                       │
└────────────────────────────────────────────────────────────────────────┘

    Landing Page / Header                  Super Admin Portal
   ┌───────────────────────┐             ┌───────────────────────┐
   │ Customer Login Modal  │             │  Credential Center    │
   │ (Dynamic Demo Badges) │             │  (SuperAdmin/Manager/ │
   └──────────┬────────────┘             │   Staff/Customer)     │
              │                          └──────────┬────────────┘
              │                                     │
              ▼                                     ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Client AuthService (authService.ts)             │
   │  - getCredentialsInfo()      - authenticateUser()           │
   │  - updateSelfCredentials()   - syncCredentialsFromServer()  │
   │  - getPublicDemoAccounts()   - rbacConfig / userAccounts    │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Express API Engine (server.ts)                  │
   │  - GET  /api/auth/credentials-info                          │
   │  - GET  /api/auth/public-demo-accounts                      │
   │  - POST /api/auth/login (Manager/Staff/Customer)            │
   │  - POST /api/auth/super-admin/login                         │
   │  - POST /api/auth/update-account-credentials                │
   │  - POST /api/auth/super-admin/update-credentials            │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Persistent Data Store (data/db.json)            │
   │  - superAdminCredentials: { userId, password, email }       │
   │  - adminCredentials:      { userId, password, recoveryEmail }│
   │  - rbac.users:            [ Manager, Staff, Customer ]      │
   └─────────────────────────────────────────────────────────────┘
```

### Data Model & Role Mapping

- **AppRole**: `"super_admin" | "manager" | "staff" | "customer"`
- **Customer User Account Schema**:
  ```ts
  {
    id: "user-customer",
    username: "client",
    displayName: "Client Account",
    role: "customer",
    password: "Client@123",
    status: "active",
    permissions: {
      canViewLeads: true,
      canExportReports: true,
      canEditLeads: false,
      canDeleteLeads: false,
      canChangeSettings: false
    }
  }
  ```
- **Super Admin Credentials Schema**:
  ```ts
  {
    userId: "superadmin", // default or updated
    password: "SuperAdmin@2026", // default or updated
    email: "superadmin@leadplatform.io"
  }
  ```

---

## 5. Execution Steps

1. **Backend Endpoints (`server.ts`)**:
   - Add `/api/auth/public-demo-accounts` returning current active usernames and passwords (or masked passwords for demo autofill) for Customer, Manager, and Staff.
   - Update `/api/auth/login` to validate Customer accounts and return `role: "customer"`.
   - Add `/api/auth/super-admin/update-credentials` to allow changing Super Admin User ID and Password.
   - Update `/api/auth/update-account-credentials` to support Customer credential modifications.
   - Ensure `dbStore` persists customer user accounts in `rbac.users` and saves to `data/db.json`.

2. **Client Authentication Layer (`authService.ts` & `apiClient.ts`)**:
   - Update `AppRole` to include `"customer"`.
   - Add `DEFAULT_CUSTOMER_USER` and permission helpers for customer view-only mode (`isCustomer()`).
   - Implement `fetchPublicDemoAccounts()` and `updateSuperAdminCredentials()`.

3. **Customer & Client Login Modal (`SaaSLandingPage.tsx`)**:
   - Replace hardcoded demo text with dynamic values fetched from `fetchPublicDemoAccounts()`.
   - Add 1-click demo filler buttons for **Manager**, **Staff**, and **Customer**.
   - Upon Customer login, launch the Workspace with `customer` role and view-only guard.

4. **Super Admin Console (`SuperAdminPortal.tsx`)**:
   - Integrate a new **"Credential Governance"** tab.
   - Allow Super Admin to view and update credentials for all 4 roles (Super Admin, Manager, Staff, Customer).
   - Display instant feedback and audit logs for credential modifications.

5. **Workspace Settings (`AccountSettingsModal.tsx` & `RbacSettingsTab.tsx`)**:
   - Enable Managers to change their own login credentials and configure Customer portal passwords.

6. **Customer Workspace View (`App.tsx`, `LeadTable.tsx`, `Header.tsx`)**:
   - Display a clean view-only badge when logged in as Customer.
   - Prevent mutating actions (uploading new spreadsheets, deleting leads, reassigning handlers) with friendly informative tooltips.

7. **Verification**:
   - Compile applet with `compile_applet`.
   - Test login as Customer, Staff, Manager, and Super Admin.
   - Verify that updating credentials in Super Admin Console updates the login demo cards and allows logging in with the newly set password.
