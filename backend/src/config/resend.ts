import { logger } from './logger';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface ResendAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
}

export interface ResendPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text?: string;
  attachments?: ResendAttachment[];
}

export interface ResendResult {
  id: string;
}

/**
 * Minimal Resend REST client.
 *
 * Deliberately built on `fetch` rather than the SDK: this is one POST, and
 * avoiding the dependency keeps the send path free of a package whose major
 * versions move faster than this endpoint does.
 */
export const sendViaResend = async (
  apiKey: string,
  payload: ResendPayload,
): Promise<ResendResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        ...(payload.cc?.length ? { cc: payload.cc } : {}),
        ...(payload.bcc?.length ? { bcc: payload.bcc } : {}),
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok) {
      // Resend's own message is far more actionable than the status code —
      // it names the unverified domain or the malformed address directly.
      const reason = body.message ?? body.name ?? `HTTP ${response.status}`;
      throw new Error(reason);
    }

    if (!body.id) throw new Error('Resend accepted the request but returned no message id');

    logger.info('Email sent via Resend', { messageId: body.id });
    return { id: body.id };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Resend request timed out after 30s');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export interface ResendVerification {
  ok: boolean;
  error?: string;
  /** True when the key is valid but scoped to sending only. */
  sendOnly?: boolean;
  /** Domains available as a From address; empty for send-only keys. */
  domains?: string[];
}

/**
 * Resend has no "check this credential" endpoint, so the key is probed against
 * `GET /domains`.
 *
 * A send-only key is *rejected* by that endpoint — but the specific rejection
 * ("restricted to only send emails") can only be produced by Resend after it
 * has authenticated the key, so it proves validity rather than disproving it.
 * Treating that 401 as a failure would wrongly mark perfectly good send-only
 * keys as broken, which is the common case for keys minted for one app.
 */
export const verifyResendKey = async (apiKey: string): Promise<ResendVerification> => {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        data?: { name: string; status: string }[];
      };
      const verified = (body.data ?? [])
        .filter((domain) => domain.status === 'verified')
        .map((domain) => domain.name);
      return { ok: true, domains: verified };
    }

    const body = (await response.json().catch(() => ({}))) as { message?: string };
    const message = body.message ?? '';

    if (/restricted to only send/i.test(message)) {
      return { ok: true, sendOnly: true, domains: [] };
    }

    return { ok: false, error: message || `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
