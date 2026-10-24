import { Lead, CallStatus } from "../types";

export interface CallHandlingGuide {
  status: CallStatus;
  objective: string;
  badgeColor: string;
  openingScript: string;
  talkingPoints: string[];
  keyTips: string[];
  recommendedOutcome: string;
}

/**
 * Generates dynamic, context-aware call handling instructions for a client lead.
 * Considers client name, assigned handler, payment receipt, proof, month, city, and prior notes.
 */
export function getClientCallHandlingGuide(
  lead: Lead,
  handlerName?: string
): CallHandlingGuide {
  const handler = handlerName || lead.handlerName || "Account Specialist";
  const clientName = lead.fullName || "Client";
  const month = lead.month || lead.lostYearOrMonth || "recent period";
  const city = lead.city && lead.city !== "Unknown" ? lead.city : null;
  const receipt = lead.paymentReceipt && lead.paymentReceipt !== "Pending Receipt" 
    ? lead.paymentReceipt 
    : null;
  const proof = lead.proof || "on file";

  switch (lead.status) {
    case "Interested":
      return {
        status: "Interested",
        badgeColor: "emerald",
        objective: "Confirm payment verification, finalize onboarding, and agree on next milestone",
        openingScript: `Hello ${clientName}, this is ${handler}. I'm following up on your ${month} record regarding your payment receipt ${receipt ? `#${receipt}` : "details"}. We are delighted to assist you and wanted to confirm your next onboarding steps. Do you have 2 minutes to finalize?`,
        talkingPoints: [
          receipt
            ? `Validate receipt #${receipt} (${proof}) and confirm all payment records match.`
            : `Verify payment documentation and provide payment confirmation receipt.`,
          city ? `Acknowledge client location in ${city} and verify local contact preferences.` : `Confirm the best phone and email for correspondence.`,
          lead.manualNotes
            ? `Follow up on prior note: "${lead.manualNotes}"`
            : `Confirm preferred timeline for start or delivery.`,
          `Set concrete next appointment or welcome email handoff.`,
        ],
        keyTips: [
          "Strike while the iron is hot: client showed interest, maintain momentum.",
          "Reassure them with payment proof confirmation so they feel completely secure.",
          "Record any special delivery or service requests directly into Manual Notes.",
        ],
        recommendedOutcome: "Mark Interested, schedule kickoff, and document confirmed receipt details.",
      };

    case "Requires Follow-up":
      return {
        status: "Requires Follow-up",
        badgeColor: "amber",
        objective: "Resolve pending questions, address hesitation, and establish an agreed decision timeline",
        openingScript: `Hi ${clientName}, ${handler} here. I am following up on our previous conversation regarding your ${month} file. I wanted to check if you had a chance to review the details and see what questions I can answer for you today.`,
        talkingPoints: [
          lead.manualNotes
            ? `Reference previous discussion: "${lead.manualNotes}"`
            : `Check where they currently stand regarding their ${month} inquiry.`,
          receipt
            ? `Clarify any questions regarding payment receipt #${receipt} or proof documentation.`
            : `Inquire if invoice or payment receipt clarification is needed.`,
          `Identify primary friction point (timing, budget, team approval, or technical requirements).`,
          `Agree on a specific day and time for the next touchpoint.`,
        ],
        keyTips: [
          "Listen more than you talk: let the client voice their real concern.",
          "Do not rush to a hard close; position yourself as a helpful problem solver.",
          "Always finish with a specific callback time (e.g., 'Tuesday at 10 AM').",
        ],
        recommendedOutcome: "Update Manual Notes with new feedback; set status to Interested if resolved.",
      };

    case "Pending Call":
      return {
        status: "Pending Call",
        badgeColor: "blue",
        objective: "Make warm first contact, qualify requirements, and establish handler rapport",
        openingScript: `Good day ${clientName}! This is ${handler}. I am reaching out regarding your inquiry for ${month}${city ? ` in ${city}` : ""}. I wanted to introduce myself as your designated handler and verify your file details. How are things going today?`,
        talkingPoints: [
          `Confirm client's identity and confirm ${city ? `they are based in ${city}` : "their contact location"}.`,
          `Reference ${month} lead registration and confirm current interest level.`,
          receipt
            ? `Mention payment receipt #${receipt} has been received and is under review.`
            : `Explain our simple payment and onboarding process.`,
          `Outline what your team can deliver and ask what their target timeline is.`,
        ],
        keyTips: [
          "Make the first 10 seconds count: sound energetic, friendly, and well-prepared.",
          "State your name and company clearly so the client knows it is a legitimate follow-up.",
          "Immediately log the outcome: if they answered, move to Interested or Requires Follow-up.",
        ],
        recommendedOutcome: "Transition from Pending Call to either Interested or Requires Follow-up.",
      };

    case "No Answer":
      return {
        status: "No Answer",
        badgeColor: "rose",
        objective: "Leave a concise, professional voicemail and trigger secondary follow-up channel",
        openingScript: `Hello ${clientName}, this is ${handler} following up on your ${month} record regarding receipt ${receipt || "information"}. I will send you a quick follow-up message with the details. You can reach me back at this number or reply to my message. Have a wonderful day!`,
        talkingPoints: [
          `Keep voicemail strictly under 25 seconds; speak clearly and unhurriedly.`,
          `State your name (${handler}), company name, and reason (${month} record / receipt ${receipt || ""}).`,
          `Provide your direct telephone number clearly twice.`,
          `Follow up with an email or SMS/WhatsApp referencing the same details.`,
        ],
        keyTips: [
          "Do not call repeatedly in the same hour; try varying the time of day on the next attempt.",
          "Track call count: if this is attempt #2 or #3, send an email to ensure reachability.",
          "Click the tel: link to dial, then log 'No Answer' so the call count increments automatically.",
        ],
        recommendedOutcome: "Log No Answer, note time of attempt, and schedule retry for tomorrow.",
      };

    case "Not Interested":
      return {
        status: "Not Interested",
        badgeColor: "slate",
        objective: "Courteous feedback gathering, graceful exit, and leaving the door open for future needs",
        openingScript: `Hello ${clientName}, this is ${handler}. Thank you for taking a moment. I noticed you previously signaled you were not ready to proceed with the ${month} record. I am just conducting a quick quality check to see if your requirements have shifted or if we can archive your file?`,
        talkingPoints: [
          `Respect their decision immediately—never sound confrontational or pushy.`,
          `Politely ask: "Was it a question of timing, or did you choose an alternative solution?"`,
          `Note down the exact objection in Manual Notes for team improvement.`,
          `Confirm whether they would like to be kept in touch for future quarterly updates.`,
        ],
        keyTips: [
          "Clients often reconsider when treated with genuine courtesy after saying no.",
          "Archive or flag appropriately to prevent spamming unassigned clients.",
          "Log feedback accurately to help team refine client qualification.",
        ],
        recommendedOutcome: "Record reason in Manual Notes; retain record for compliance or future recall.",
      };

    default:
      return {
        status: "Requires Follow-up",
        badgeColor: "indigo",
        objective: "Client engagement and file status review",
        openingScript: `Hello ${clientName}, this is ${handler} calling to follow up on your account record. How can I assist you today?`,
        talkingPoints: [
          `Confirm client name and contact details.`,
          `Review payment receipt and month information.`,
          `Document next steps and update notes.`,
        ],
        keyTips: [
          "Ensure manual notes are typed in the table directly during or right after the call.",
        ],
        recommendedOutcome: "Log call and update status.",
      };
  }
}
