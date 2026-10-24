import { Lead, UploadedFileRecord } from "../types";
import { getLocalDateString } from "../utils/dateUtils";

export const DEFAULT_UPLOADED_FILES: UploadedFileRecord[] = [
  {
    id: "file-today-1",
    fileName: "September_Client_Register.xlsx",
    uploadDate: getLocalDateString(0), // Today
    uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    fileSize: "28.4 KB",
    fileType: "xlsx",
    recordCount: 5,
  },
  {
    id: "file-tomorrow-1",
    fileName: "Tomorrow_Priority_Followups.xlsx",
    uploadDate: getLocalDateString(1), // Tomorrow
    uploadedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    fileSize: "19.8 KB",
    fileType: "xlsx",
    recordCount: 2,
  },
];

export const DEFAULT_SAMPLE_LEADS: Lead[] = [
  {
    id: "lead-1",
    paymentReceipt: "REC-2023-8891 ($1,250.00)",
    proof: "Bank Wire Slip Verified",
    month: "October 2023",
    lostYearOrMonth: "October 2023",
    fullName: "Marcus Vance",
    phoneNumber: "+1 (312) 555-0182",
    email: "m.vance@vancetech.io",
    city: "Chicago",
    status: "Requires Follow-up",
    notes: "Lost due to Q4 budget freezes. Expressed strong interest in reopening contract discussion in Q2.",
    manualNotes: "Follow up Tuesday 2 PM; requested customized enterprise quote.",
    handlerId: "handler-helen",
    handlerName: "Helen",
    assignmentCategory: "assigned",
    assignedAt: new Date(new Date().setHours(14, 15, 0, 0)).toISOString(), // 2:15 PM today (pre-cutoff)
    reportDate: getLocalDateString(0),
    isPostCutoffRollover: false,
    createdAt: new Date().toISOString(),
    callCount: 1,
    lastDialedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    uploadDate: getLocalDateString(0), // Today
    uploadedFileName: "September_Client_Register.xlsx",
    fileId: "file-today-1",
  },
  {
    id: "lead-2",
    paymentReceipt: "INV-90422 ($3,400.00)",
    proof: "Stripe Conf #ch_3NgK",
    month: "July 2023",
    lostYearOrMonth: "July 2023",
    fullName: "Elena Rostova",
    phoneNumber: "+1 (512) 555-0349",
    email: "elena.rostova@cloudscale.net",
    city: "Austin",
    status: "Interested",
    paymentDate: getLocalDateString(0),
    paymentMethod: "Card",
    completionStatus: "Completed",
    completedAt: new Date().toISOString(),
    notes: "Attended re-engagement call on Monday. Client requested updated enterprise pricing sheet.",
    manualNotes: "Client sent NDA. Prepare 25-seat license proposal.",
    handlerId: "handler-athira",
    handlerName: "Athira",
    assignmentCategory: "assigned",
    assignedAt: new Date(new Date().setHours(16, 45, 0, 0)).toISOString(), // 4:45 PM today (pre-cutoff)
    reportDate: getLocalDateString(0),
    isPostCutoffRollover: false,
    createdAt: new Date().toISOString(),
    callCount: 2,
    lastDialedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    uploadDate: getLocalDateString(0), // Today
    uploadedFileName: "September_Client_Register.xlsx",
    fileId: "file-today-1",
  },
  {
    id: "lead-3",
    paymentReceipt: "REC-2024-014 ($850.00)",
    proof: "Direct Deposit Transfer Receipt",
    month: "March 2024",
    lostYearOrMonth: "March 2024",
    fullName: "David Sterling",
    phoneNumber: "+1 (303) 555-0914",
    email: "david.sterling@peaksummit.co",
    city: "Denver",
    status: "Requires Follow-up",
    notes: "Churned during platform migration. Follow-up needed regarding new API sync capabilities.",
    manualNotes: "Awaiting their tech lead approval.",
    handlerId: "handler-helen",
    handlerName: "Helen",
    assignmentCategory: "assigned",
    assignedAt: new Date(new Date().setHours(23, 20, 0, 0)).toISOString(), // 11:20 PM today
    reportDate: getLocalDateString(0), // Daily report without time restrictions
    isPostCutoffRollover: false,
    createdAt: new Date().toISOString(),
    callCount: 0,
    uploadDate: getLocalDateString(0), // Today
    uploadedFileName: "September_Client_Register.xlsx",
    fileId: "file-today-1",
  },
  {
    id: "lead-4",
    paymentReceipt: "TXN-88412 ($2,100.00)",
    proof: "ACH Transfer Ref #9921",
    month: "November 2022",
    lostYearOrMonth: "November 2022",
    fullName: "Samantha Chen",
    phoneNumber: "+1 (404) 555-0872",
    email: "s.chen@atlantamarketing.org",
    city: "Atlanta",
    status: "Pending Call",
    notes: "Previous champion switched departments. Need to dial and ask for current operations director.",
    manualNotes: "Call reception first: ext 402.",
    handlerName: "",
    assignmentCategory: "unassigned",
    createdAt: new Date().toISOString(),
    callCount: 0,
    uploadDate: getLocalDateString(0), // Today
    uploadedFileName: "September_Client_Register.xlsx",
    fileId: "file-today-1",
  },
  {
    id: "lead-7",
    paymentReceipt: "REC-2024-512 ($1,100.00)",
    proof: "Direct Deposit Slip #DD-402",
    month: "April 2024",
    lostYearOrMonth: "April 2024",
    fullName: "Lucas Silva",
    phoneNumber: "+1 (415) 555-0671",
    email: "lucas.silva@pacificbay.io",
    city: "San Francisco",
    status: "Requires Follow-up",
    notes: "Reopened inquiry after annual tech renewal. Expressed interest in new security compliance tier.",
    manualNotes: "Requested product comparison sheet.",
    handlerName: "",
    assignmentCategory: "unassigned",
    createdAt: new Date().toISOString(),
    callCount: 0,
    uploadDate: getLocalDateString(0), // Today
    uploadedFileName: "September_Client_Register.xlsx",
    fileId: "file-today-1",
  },
  {
    id: "lead-5",
    paymentReceipt: "REC-2023-7412 ($4,500.00)",
    proof: "Signed PO & Wire Slip",
    month: "August 2023",
    lostYearOrMonth: "August 2023",
    fullName: "Jonathan Blake",
    phoneNumber: "+1 (206) 555-0428",
    email: "jblake@cascadepacific.com",
    city: "Seattle",
    status: "Interested",
    paymentDate: getLocalDateString(1),
    paymentMethod: "Bank Transfer",
    completionStatus: "Pending",
    notes: "Spoke with Jonathan. He confirmed satisfaction with new feature roadmap, agreed to pilot next month.",
    manualNotes: "Onboarding call scheduled for next Thursday.",
    handlerId: "handler-athira",
    handlerName: "Athira",
    assignmentCategory: "assigned",
    createdAt: new Date().toISOString(),
    callCount: 3,
    lastDialedAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    uploadDate: getLocalDateString(1), // Tomorrow
    uploadedFileName: "Tomorrow_Priority_Followups.xlsx",
    fileId: "file-tomorrow-1",
  },
  {
    id: "lead-6",
    paymentReceipt: "INV-66109 ($1,800.00)",
    proof: "Verified PayPal Trans #882B",
    month: "November 2023",
    lostYearOrMonth: "November 2023",
    fullName: "Priya Patel",
    phoneNumber: "+1 (619) 555-0155",
    email: "priya.patel@solardrive.io",
    city: "San Diego",
    status: "Requires Follow-up",
    notes: "Competitor discount ended last quarter. Call to schedule a 15-minute value comparison call.",
    manualNotes: "Interested in annual billing discount.",
    handlerId: "handler-helen",
    handlerName: "Helen",
    assignmentCategory: "assigned",
    createdAt: new Date().toISOString(),
    callCount: 1,
    lastDialedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    uploadDate: getLocalDateString(1), // Tomorrow
    uploadedFileName: "Tomorrow_Priority_Followups.xlsx",
    fileId: "file-tomorrow-1",
  },
];

export const RAW_CSV_SAMPLE = `Payment Receipt,Proof,Month,Full Name,Phone Number,Email ID,City,Status,Notes
REC-2023-9901 ($2,500),Bank Slip Verified,October 2023,Benjamin Hayes,+1 (214) 555-0193,ben.hayes@apexlogistics.com,Dallas,Requires Follow-up,Lost when regional depot downsized. Now expanding into new fulfillment centers.
INV-10928 ($1,450),Stripe #ch_8819A,May 2024,Sophia Martinez,+1 (305) 555-0781,smartinez@biscayneglobal.com,Miami,Interested,Attended call yesterday. Agreed to schedule demo with VP of Operations.
TXN-44910 ($3,200),Wire Conf #8301,November 2022,Arthur Pendelton,+1 (617) 555-0632,arthur@beaconhilladvisors.com,Boston,Requires Follow-up,Account went dormant after corporate merger. Needs re-verification of contact email.
REC-2023-3392 ($950),ACH Verified #229,September 2023,Nadia Kaur,+1 (415) 555-0988,nadia.kaur@baylineai.org,San Francisco,Pending Call,Inquiry received during webinar. Needs initial outreach call.
INV-88201 ($4,100),PO Slip #5502,January 2024,Liam O'Connor,+1 (602) 555-0127,liam.oconnor@desertpeak.net,Phoenix,Interested,Connected with Liam; requested phone follow-up every quarter.`;

export const RAW_UNSTRUCTURED_SAMPLE = `--- CUSTOMER PAYMENT & LEAD REGISTER ---

Account #1:
Contact Person: Victoria Sterling
Payment Receipt: REC-2023-9021 ($2,400)
Proof of Payment: Bank Wire Receipt #BW-8820
Month: October 2023
Direct Dial: +1-704-555-0319
Email: victoria.sterling@charlottefin.com
City / Location: Charlotte
Historical Notes: Re-evaluate once their new procurement head joins in Q1. High potential deal.

Account #2:
Lead: Gregory Alvarez
Payment Receipt: INV-7741 ($1,950)
Proof: Stripe Verification #ch_4992
Month: August 2022
Contact Info: Cell is +1 (503) 555-0492 | gregalvarez@portlandtimber.io
HQ City: Portland
Disposition: Interested
Account Notes: Called last week and held 20min catchup. Gregory requested new pricing tier sheet.

Account #3:
Name: Chloe Dupont
Payment Receipt: REC-2024-118 ($3,100)
Proof: ACH Transfer Slip #9910
Month: February 2024
Telephone: +1-615-555-0834
Email Address: chloe.dupont@musiccitydist.com
Location City: Nashville
Call Action Needed: Requires Follow-up
Rep Notes: Switched to legacy competitor whose annual license expires this autumn. Keep warm.`;
