
/**
 * Xero API integration helper — Phase 4.2
 *
 * Uses the Xero Accounting API directly via native fetch (Node 18+).
 *
 * Required environment variables (all 4 for live push):
 *   XERO_CLIENT_ID      — OAuth 2.0 application client ID
 *   XERO_CLIENT_SECRET  — OAuth 2.0 application client secret
 *   XERO_ACCESS_TOKEN   — A valid Bearer access token (short-lived, ~30 min)
 *   XERO_TENANT_ID      — The Xero organisation (tenant) ID
 *
 * Optional:
 *   XERO_REFRESH_TOKEN  — Refresh token for automatic token renewal.
 *                         When present, a 401 during push triggers one refresh
 *                         attempt using this token. The new access token is
 *                         cached in-memory for this server process lifetime.
 *                         NOTE: Xero refresh tokens rotate — when a refresh
 *                         succeeds, Xero issues a new refresh token. The new
 *                         refresh token is logged server-side (NOT exposed to
 *                         browser) so staff can update XERO_REFRESH_TOKEN.
 *                         In-memory cache is lost on server restart.
 *
 * SteelIQ invoice identity is separate from Xero invoice identity.
 * Xero-assigned InvoiceID and InvoiceNumber are stored on the SteelIQ record.
 *
 * Accounting configuration:
 *   AccountCode — configurable per org (stored in orgSettings.xeroAccountCode,
 *                 default "200" = standard Xero NZ Sales account)
 *   TaxType     — configurable per org (stored in orgSettings.xeroTaxType,
 *                 default "OUTPUT2" = NZ 15% GST)
 */

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";

// ── In-memory token cache ───────────────────────────────────────────────────
// Refreshed access tokens are cached here for the process lifetime.
// Lost on server restart — staff must update XERO_ACCESS_TOKEN env var manually
// after they receive the new token values logged server-side.
let _cachedAccessToken: string | null = null;

function getActiveAccessToken(): string | null {
  return _cachedAccessToken ?? process.env.XERO_ACCESS_TOKEN ?? null;
}

export type XeroConfig = {
  accessToken: string;
  tenantId: string;
};

export type XeroPushResult = {
  xeroInvoiceId: string;
  xeroInvoiceNumber: string;
  xeroStatus: string;
};

export type XeroErrorDetail = {
  code: number;
  message: string;
  detail?: string;
  validationErrors?: string[];
};

// ── Configuration checks ─────────────────────────────────────────────────────

/**
 * Returns true only when all four required env vars are present.
 */
export function isXeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_ACCESS_TOKEN &&
    process.env.XERO_TENANT_ID
  );
}

/**
 * Returns true when a refresh token is available for automatic renewal.
 */
export function hasRefreshToken(): boolean {
  return !!process.env.XERO_REFRESH_TOKEN;
}

/**
 * Returns the Xero configuration. Uses the in-memory cached token if available,
 * otherwise falls back to the XERO_ACCESS_TOKEN env var.
 */
export function getXeroConfig(): XeroConfig {
  const accessToken = getActiveAccessToken();
  const tenantId = process.env.XERO_TENANT_ID;
  if (!accessToken) throw new Error("XERO_ACCESS_TOKEN is not set. Cannot perform live Xero push.");
  if (!tenantId) throw new Error("XERO_TENANT_ID is not set. Cannot perform live Xero push.");
  return { accessToken, tenantId };
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Attempts to refresh the Xero access token using XERO_REFRESH_TOKEN.
 *
 * On success:
 *  - Caches the new access token in-memory (_cachedAccessToken)
 *  - Logs the new token values SERVER-SIDE ONLY so staff can update env vars
 *  - Returns the new access token string
 *
 * On failure:
 *  - Throws a descriptive error
 *  - Does NOT modify _cachedAccessToken
 *
 * IMPORTANT: Xero issues a new refresh token on each refresh (rotating tokens).
 * The new refresh token is logged server-side. Staff must update XERO_REFRESH_TOKEN
 * before the old one expires (60-day window). Failure to rotate will require
 * re-authentication via the Xero Developer Portal.
 */
export async function tryRefreshXeroToken(): Promise<string> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const refreshToken = process.env.XERO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Cannot refresh Xero token: XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REFRESH_TOKEN must all be set."
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
  } catch (networkErr: any) {
    throw new Error(`Network error reaching Xero token endpoint: ${networkErr.message}`);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Xero token endpoint returned HTTP ${response.status} with an unparseable response.`);
  }

  if (!response.ok) {
    const detail = body?.error_description ?? body?.error ?? JSON.stringify(body).slice(0, 200);
    throw new Error(
      `Xero token refresh failed (HTTP ${response.status}): ${detail}. ` +
      "Re-authenticate via the Xero Developer Portal to obtain fresh credentials."
    );
  }

  const newAccessToken: string = body.access_token;
  const newRefreshToken: string | undefined = body.refresh_token;

  if (!newAccessToken) {
    throw new Error("Xero token refresh succeeded but response contained no access_token.");
  }

  // Cache in-memory
  _cachedAccessToken = newAccessToken;

  // Log server-side ONLY — never exposed to browser
  // Staff must update env vars with these values before next restart
  console.log("[Xero] Token refreshed successfully. Update env vars on next restart:");
  console.log(`[Xero] New XERO_ACCESS_TOKEN: ${newAccessToken.slice(0, 8)}... (${newAccessToken.length} chars)`);
  if (newRefreshToken) {
    console.log(`[Xero] New XERO_REFRESH_TOKEN: ${newRefreshToken.slice(0, 8)}... (${newRefreshToken.length} chars)`);
    console.log("[Xero] WARNING: Xero refresh tokens rotate. Update XERO_REFRESH_TOKEN before the current in-memory session ends.");
  }

  return newAccessToken;
}

// ── Payload mapping ──────────────────────────────────────────────────────────

export type XeroInvoicePayload = {
  Type: "ACCREC";
  Contact: { ContactID?: string; Name?: string };
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType: string;
  }>;
  Status: "DRAFT";
  CurrencyCode: "NZD";
  Reference: string;
};

/**
 * Maps a SteelIQ invoice record to a Xero Invoice API payload.
 *
 * AccountCode and TaxType are now configurable (from orgSettings):
 *   - accountCode: default "200" (standard Xero NZ Sales account)
 *   - taxType: default "OUTPUT2" (NZ 15% GST)
 *
 * Contact linking:
 *   - If xeroContactId is provided: uses ContactID (exact Xero contact match)
 *   - Otherwise: uses customer Name (Xero matches/creates by name — may create duplicates)
 *   For production, set xeroContactId on each customer via Customers → Edit Customer.
 *
 * Fails clearly if:
 *   - No customer name AND no xeroContactId (contact required by Xero)
 *   - amountExclGst is missing (UnitAmount required)
 *   - accountCode is empty string
 *   - taxType is empty string
 */
export function buildXeroInvoicePayload(params: {
  invoiceNumber: string | null | undefined;
  type: string;
  customerName: string | null | undefined;
  xeroContactId: string | null | undefined;
  amountExclGst: number | null | undefined;
  description: string | null | undefined;
  notes: string | null | undefined;
  accountCode: string;
  taxType: string;
}): XeroInvoicePayload {
  const {
    invoiceNumber,
    type,
    customerName,
    xeroContactId,
    amountExclGst,
    description,
    notes,
    accountCode,
    taxType,
  } = params;

  if (!customerName && !xeroContactId) {
    throw new Error(
      "Cannot build Xero invoice payload: no customer name or Xero contact ID available. " +
      "Ensure the invoice is linked to a customer before pushing to Xero. " +
      "For reliable contact matching, set a Xero Contact ID on the customer record."
    );
  }

  if (amountExclGst === null || amountExclGst === undefined) {
    throw new Error(
      "Cannot build Xero invoice payload: amountExclGst is missing. " +
      "Set the invoice amount (excl. GST) before pushing to Xero."
    );
  }

  const resolvedAccountCode = accountCode.trim();
  const resolvedTaxType = taxType.trim();

  if (!resolvedAccountCode) {
    throw new Error(
      "Cannot build Xero invoice payload: Xero account code is empty. " +
      "Set a valid account code in Settings → Xero → Accounting Configuration (e.g. '200' for Sales)."
    );
  }

  if (!resolvedTaxType) {
    throw new Error(
      "Cannot build Xero invoice payload: Xero tax type is empty. " +
      "Set a valid tax type in Settings → Xero → Accounting Configuration (e.g. 'OUTPUT2' for NZ 15% GST)."
    );
  }

  const lineDescription =
    description ||
    notes ||
    `SteelIQ ${type.replace(/_/g, " ")} invoice` +
      (invoiceNumber ? ` — ${invoiceNumber}` : "");

  const contact: { ContactID?: string; Name?: string } = xeroContactId
    ? { ContactID: xeroContactId }
    : { Name: customerName! };

  return {
    Type: "ACCREC",
    Contact: contact,
    LineItems: [
      {
        Description: lineDescription,
        Quantity: 1,
        UnitAmount: amountExclGst,
        AccountCode: resolvedAccountCode,
        TaxType: resolvedTaxType,
      },
    ],
    Status: "DRAFT",
    CurrencyCode: "NZD",
    Reference: invoiceNumber ?? "",
  };
}

// ── Live push ─────────────────────────────────────────────────────────────────

/**
 * Performs a live Xero invoice creation via the Xero Accounting API.
 *
 * Automatic token refresh:
 *   On a 401 response, if XERO_REFRESH_TOKEN is set, attempts one token refresh
 *   and retries the request with the new token. If refresh also fails, returns
 *   a 401 error without modifying the SteelIQ invoice state.
 *
 * Error isolation:
 *   All errors throw — the caller MUST NOT update invoice state on throw.
 *   The SteelIQ invoice remains in ready_for_xero and can be retried.
 */
export async function createXeroInvoice(
  payload: XeroInvoicePayload,
  config: XeroConfig
): Promise<XeroPushResult> {
  const result = await attemptXeroCreate(payload, config.accessToken, config.tenantId);
  return result;
}

async function attemptXeroCreate(
  payload: XeroInvoicePayload,
  accessToken: string,
  tenantId: string,
  isRetry = false
): Promise<XeroPushResult> {
  const url = `${XERO_API_BASE}/Invoices`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-Tenant-Id": tenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ Invoices: [payload] }),
    });
  } catch (networkErr: any) {
    throw new Error(
      `Network error reaching Xero API: ${networkErr.message}. ` +
      "Check that the server has outbound internet access."
    );
  }

  // ── Handle 401 with refresh-token retry ────────────────────────────────────
  if (response.status === 401 && !isRetry && hasRefreshToken()) {
    console.log("[Xero] 401 Unauthorised — attempting token refresh before retry.");
    let newToken: string;
    try {
      newToken = await tryRefreshXeroToken();
    } catch (refreshErr: any) {
      throw new XeroPushError({
        code: 401,
        message:
          `Xero access token expired and automatic refresh failed: ${refreshErr.message} ` +
          "Re-authenticate via the Xero Developer Portal and update XERO_ACCESS_TOKEN and XERO_REFRESH_TOKEN.",
      });
    }
    // Retry once with the new token
    return attemptXeroCreate(payload, newToken, tenantId, true);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Xero API returned HTTP ${response.status} with an unparseable response body.`
    );
  }

  if (!response.ok) {
    const detail = extractXeroErrorDetail(response.status, body);
    throw new XeroPushError(detail);
  }

  const invoice = body?.Invoices?.[0];
  if (!invoice) {
    throw new Error(
      "Xero API returned a success response but no invoice data was present in the body."
    );
  }

  if (invoice.HasErrors || (invoice.ValidationErrors && invoice.ValidationErrors.length > 0)) {
    const validationMessages = (invoice.ValidationErrors ?? [])
      .map((e: any) => e.Message ?? JSON.stringify(e))
      .join("; ");
    throw new Error(
      `Xero accepted the request but returned validation errors: ${validationMessages}. ` +
      "Common causes: invalid AccountCode (check Settings → Xero), invalid TaxType, or missing required contact fields."
    );
  }

  return {
    xeroInvoiceId: invoice.InvoiceID,
    xeroInvoiceNumber: invoice.InvoiceNumber,
    xeroStatus: invoice.Status ?? "DRAFT",
  };
}

// ── Error types ───────────────────────────────────────────────────────────────

export class XeroPushError extends Error {
  readonly detail: XeroErrorDetail;
  constructor(detail: XeroErrorDetail) {
    super(detail.message);
    this.detail = detail;
    this.name = "XeroPushError";
  }
}

function extractXeroErrorDetail(httpStatus: number, body: any): XeroErrorDetail {
  const validationErrors: string[] = [];

  if (body?.Elements) {
    for (const el of body.Elements) {
      for (const ve of el.ValidationErrors ?? []) {
        if (ve.Message) validationErrors.push(ve.Message);
      }
    }
  }

  if (httpStatus === 401) {
    return {
      code: 401,
      message:
        "Xero rejected the access token (401 Unauthorised). " +
        (hasRefreshToken()
          ? "Automatic refresh was already attempted but also failed. "
          : "Set XERO_REFRESH_TOKEN to enable automatic token refresh. ") +
        "Re-authenticate via the Xero Developer Portal and update XERO_ACCESS_TOKEN.",
      validationErrors,
    };
  }

  if (httpStatus === 403) {
    return {
      code: 403,
      message:
        "Xero returned 403 Forbidden. Possible causes: " +
        "(1) OAuth app lacks 'accounting.transactions' write scope — check app permissions in Xero Developer Portal; " +
        "(2) Incorrect XERO_TENANT_ID — verify against Xero → Settings → Connected Apps.",
      validationErrors,
    };
  }

  if (httpStatus === 400) {
    const accountCodeError = validationErrors.some((e) => e.toLowerCase().includes("account"));
    const taxTypeError = validationErrors.some((e) => e.toLowerCase().includes("tax"));
    const contactError = validationErrors.some((e) => e.toLowerCase().includes("contact"));

    let hint = "";
    if (accountCodeError) hint += " Check AccountCode in Settings → Xero → Accounting Configuration.";
    if (taxTypeError) hint += " Check TaxType in Settings → Xero → Accounting Configuration.";
    if (contactError) hint += " Set a Xero Contact ID on the customer record for reliable contact matching.";

    const msg =
      validationErrors.length > 0
        ? `Xero validation failed: ${validationErrors.join("; ")}.${hint}`
        : `Xero returned a 400 Bad Request. Body: ${JSON.stringify(body).slice(0, 400)}`;
    return { code: 400, message: msg, validationErrors };
  }

  const rawMsg = body?.Message ?? body?.message ?? JSON.stringify(body).slice(0, 200);
  return {
    code: httpStatus,
    message: `Xero API error (HTTP ${httpStatus}): ${rawMsg}`,
    validationErrors,
  };
}
