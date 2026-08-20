import { AiTone, EmailPurpose } from '@prisma/client';
import type { EmailDraftContext, GenerateEmailInput } from './ai.types';

const TONE_GUIDANCE: Record<AiTone, string> = {
  PROFESSIONAL: 'Polished and businesslike. Warm but not casual. No slang, no exclamation marks.',
  FRIENDLY: 'Warm and personable, like writing to a colleague you like. Contractions are fine.',
  FORMAL: 'Formal register, complete sentences, conventional salutations and sign-offs.',
  CONCISE: 'Ruthlessly brief. Three short paragraphs at most. Every sentence earns its place.',
  PERSUASIVE: 'Confident and benefit-led. Make the value obvious and the next step easy to say yes to.',
  APOLOGETIC: 'Take clear responsibility without grovelling. State the fix and the new commitment.',
  ENTHUSIASTIC: 'Energetic and positive, but still credible. Never breathless or salesy.',
  ASSERTIVE: 'Direct and firm about what is needed and by when, while staying courteous.',
};

const PURPOSE_GUIDANCE: Record<EmailPurpose, string> = {
  PROJECT_PROPOSAL:
    'Pitch the proposed work. Reference the client\'s stated problem, outline the approach at a high level, and close by proposing a specific next step (a call or a go-ahead).',
  INVOICE_DELIVERY:
    'Deliver an invoice. State the invoice number, amount and due date plainly. Keep it short and frictionless — this is an administrative email, not a sales one.',
  PAYMENT_REMINDER:
    'Chase an unpaid invoice. Stay unfailingly polite and assume good faith. Reference the invoice number, amount and how overdue it is. Offer to resend the invoice or discuss terms.',
  PROJECT_UPDATE:
    'Report progress. Lead with what was completed, then what is next, then anything you need from the client. Be specific — vague updates erode trust.',
  FOLLOW_UP:
    'Nudge an unanswered thread. Be brief and low-pressure. Give the recipient an easy out and a clear way to respond.',
  ONBOARDING:
    'Welcome a new client. Set expectations for how you will work together, communication cadence, and what you need from them to start.',
  THANK_YOU:
    'Thank the client — usually for a payment or a completed engagement. Genuine and brief. Optionally open the door to future work.',
  APOLOGY_DELAY:
    'Apologise for a delay. Own it without excessive self-flagellation, explain briefly, give a concrete revised date, and say what you are doing to prevent a repeat.',
  QUOTATION:
    'Present a quotation. State the scope, the figure and how long the quote is valid. Offer to adjust scope or phase the work.',
  COLD_OUTREACH:
    'Introduce yourself to a prospect who does not know you. Lead with something specific about them, not about you. One clear, small ask.',
  CUSTOM: 'Follow the user\'s instructions exactly.',
};

const LENGTH_GUIDANCE = {
  short: 'Around 60–90 words. Two short paragraphs.',
  medium: 'Around 120–180 words. Three paragraphs.',
  detailed: 'Around 220–300 words. Use a short bulleted list if it genuinely aids scanning.',
} as const;

export const SYSTEM_PROMPT = `You are the email-writing assistant inside a freelance software developer's business platform. You draft client emails that the developer sends under their own name.

Rules you must follow:
1. Write as the developer, in first person. Never mention that you are an AI or that the email was generated.
2. Never invent facts. If a figure, date, name or deliverable is not supplied in the context, do not state it — write around it or use the supplied placeholder token.
3. Never fabricate an invoice number, amount, deadline or scope commitment.
4. Address the recipient by the exact name given. If no name is supplied, use a neutral greeting such as "Hi there".
5. Keep the subject line under 78 characters and free of ALL CAPS, emoji and spam trigger words ("FREE", "URGENT!!", "ACT NOW").
6. Produce clean semantic HTML for the body: <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis. No <html>, <head>, <body>, <style>, <script> tags and no inline CSS.
7. Close with a sign-off using the sender's name exactly as provided.
8. Match the requested tone and length precisely.

You must respond with a single JSON object and nothing else, matching this shape:
{
  "subject": string,
  "subjectAlternatives": string[],   // exactly 2 alternative subject lines
  "bodyHtml": string,                // the email body as HTML paragraphs
  "bodyText": string,                // the same email as plain text with line breaks
  "suggestedFollowUpDays": number | null  // when to follow up if no reply, or null
}`;

/** Only includes context keys that actually have values, so the model is never shown "undefined". */
const contextBlock = (context: EmailDraftContext): string => {
  const entries = Object.entries(context).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (!entries.length) return 'No additional context supplied.';

  const labels: Record<string, string> = {
    clientName: 'Recipient name',
    clientCompany: 'Recipient company',
    senderName: 'Sender name (sign off with this)',
    companyName: 'Sender company',
    projectTitle: 'Project',
    projectSummary: 'Project summary',
    invoiceNumber: 'Invoice number',
    invoiceTotal: 'Invoice total',
    balanceDue: 'Balance outstanding',
    dueDate: 'Due date',
    daysOverdue: 'Days overdue',
    previousMessage: 'Previous message in this thread',
  };

  return entries.map(([key, value]) => `- ${labels[key] ?? key}: ${String(value)}`).join('\n');
};

export const buildUserPrompt = (input: GenerateEmailInput, context: EmailDraftContext): string => {
  const parts = [
    `PURPOSE: ${input.purpose}`,
    PURPOSE_GUIDANCE[input.purpose],
    '',
    `TONE: ${input.tone}`,
    TONE_GUIDANCE[input.tone],
    '',
    `LENGTH: ${LENGTH_GUIDANCE[input.lengthHint ?? 'medium']}`,
  ];

  if (input.language && input.language.toLowerCase() !== 'english') {
    parts.push('', `LANGUAGE: Write the entire email in ${input.language}.`);
  }

  parts.push('', 'CONTEXT:', contextBlock(context));

  if (input.instructions?.trim()) {
    parts.push(
      '',
      'SPECIFIC INSTRUCTIONS FROM THE SENDER (these take priority over the general purpose guidance):',
      input.instructions.trim(),
    );
  }

  parts.push('', 'Return only the JSON object.');
  return parts.join('\n');
};

export const IMPROVE_SYSTEM_PROMPT = `You are an editor for a freelance software developer's client emails. You are given an existing draft and an instruction describing how to change it.

Rules:
1. Preserve every factual claim in the draft — figures, dates, names, invoice numbers and commitments must survive unchanged unless the instruction explicitly says to change them.
2. Never introduce new facts.
3. Keep the same language as the original draft.
4. Output clean semantic HTML for the body, with no <html>/<head>/<body>/<style>/<script> tags and no inline CSS.

Respond with a single JSON object and nothing else:
{ "subject": string, "subjectAlternatives": string[], "bodyHtml": string, "bodyText": string, "suggestedFollowUpDays": number | null }`;

export const SUBJECT_SYSTEM_PROMPT = `You write email subject lines for a freelance software developer.
Return a single JSON object: { "subjects": string[] } containing exactly 5 subject lines.
Each must be under 78 characters, specific to the email body, free of ALL CAPS, emoji and spam trigger words.`;

export { TONE_GUIDANCE, PURPOSE_GUIDANCE };
