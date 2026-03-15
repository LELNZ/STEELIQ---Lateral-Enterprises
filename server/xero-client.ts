
/**
 * Xero API integration helper — Phase 4.1
 *
 * Uses the Xero Accounting API directly via native fetch (Node 18+).
 * Requires environment variables:
 *   XERO_CLIENT_ID      — OAuth 2.0 application client ID
 *   XERO_CLIENT_SECRET  — OAuth 2.0 application client secret
 *   XERO_ACCESS_TOKEN   — A valid Bearer access token
 *   XERO_TENANT_ID      — The Xero organisation (tenant) ID
 *
 * Token refresh: for production, implement OAuth refresh token flow.
 * This implementation uses a static access token (suitable for first live use
 * when the token is manually provisioned or recently renewed).
 *
 * SteelIQ invoice identity remains entirely separate from Xero invoice identity.
 * Xero returns its own InvoiceID (UUID) and InvoiceNumber (e.g. INV-0001).
 * These are stored on the SteelIQ invoice record as xeroInvoiceId / xeroInvoiceNumber.
 * The SteelIQ invoice record is the source of truth; Xero holds a linked copy.
 */

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

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

/**
 * Returns true only when all four required env vars are present.
 * Does not validate token freshness.
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
 * Returns the Xero configuration from environment variables.
 * Throws if any required env var is missing.
 */
export function getXeroConfig(): XeroConfig {
  const accessToken = process.env.XERO_ACCESS_TOKEN;
  const tenantId = process.env.XERO_TENANT_ID;
  if (!accessToken) throw new Error("XERO_ACCESS_TOKEN is not set. Cannot perform live Xero push.");
  if (!tenantId) throw new Error("XERO_TENANT_ID is not set. Cannot perform live Xero push.");
  return { accessToken, tenantId };
}

/**
 * Maps a SteelIQ invoice record to a Xero Invoice API payload.
 *
 * Xero requires:
 *   Type        — "ACCREC" (accounts receivable, i.e. a sales invoice)
 *   Contact     — by ContactID (preferred) or Name (Xero will match/create by name)
 *   LineItems   — at least one, with Description + UnitAmount + TaxType + AccountCode
 *   Status      — "DRAFT" (safest initial state; staff approve in Xero before sending)
 *   CurrencyCode— "NZD"
 *   Reference   — our internal invoice reference for traceability
 *
 * ContactID linkage:
 *   If customer.xeroContactId is set, that is used for exact Xero contact linking.
 *   Otherwise, customer name is used and Xero will find an existing contact by name
 *   or create a new one. For production, store xeroContactId on each customer.
 *
 * AccountCode for LineItems:
 *   Xero requires an account code for each line item. "200" is the standard
 *   "Sales" account code in Xero's default chart of accounts (NZ/AU).
 *   If your Xero organisation uses a different code, this must be configured.
 *
 * TaxType:
 *   "OUTPUT2" = standard GST at 15% (NZ). This maps amountExclGst as unit price
 *   and Xero computes the GST. The gstAmount/amountInclGst on the SteelIQ record
 *   are stored for our own records; we send exclusive amount to Xero and let Xero
 *   compute inclusive for consistency.
 */
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

export function buildXeroInvoicePayload(params: {
  invoiceNumber: string | null | undefined;
  type: string;
  customerName: string | null | undefined;
  xeroContactId: string | null | undefined;
  amountExclGst: number | null | undefined;
  description: string | null | undefined;
  notes: string | null | undefined;
}): XeroInvoicePayload {
  const {
    invoiceNumber,
    type,
    customerName,
    xeroContactId,
    amountExclGst,
    description,
    notes,
  } = params;

  if (!customerName && !xeroContactId) {
    throw new Error(
      "Cannot build Xero invoice payload: no customer name or Xero contact ID available. " +
      "Ensure the invoice is linked to a customer before pushing to Xero."
    );
  }

  if (!amountExclGst && amountExclGst !== 0) {
    throw new Error(
      "Cannot build Xero invoice payload: amountExclGst is missing. " +
      "Set invoice amounts before pushing to Xero."
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
        AccountCode: "200",
        TaxType: "OUTPUT2",
      },
    ],
    Status: "DRAFT",
    CurrencyCode: "NZD",
    Reference: invoiceNumber ?? "",
  };
}

/**
 * Performs a live Xero invoice creation via the Xero Accounting API.
 *
 * Returns the Xero-assigned InvoiceID, InvoiceNumber, and Status on success.
 * Throws a descriptive error on failure — the caller must NOT mark the SteelIQ
 * invoice as pushed if this throws.
 *
 * Error classes:
 *   - 401: expired/invalid access token — staff must re-authenticate in Xero and update XERO_ACCESS_TOKEN
 *   - 403: insufficient permissions — Xero OAuth scope does not include accounting write
 *   - 400: validation errors — payload mapping issue, reported with detail
 *   - 5xx: Xero server error — transient, retry after delay
 */
export async function createXeroInvoice(
  payload: XeroInvoicePayload,
  config: XeroConfig
): Promise<XeroPushResult> {
  const url = `${XERO_API_BASE}/Invoices`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Xero-Tenant-Id": config.tenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ Invoices: [payload] }),
    });
  } catch (networkErr: any) {
    throw new Error(
      `Network error reaching Xero API: ${networkErr.message}. ` +
      "Check that the server has internet access."
    );
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
    throw new Error("Xero API returned a success response but no invoice data was present in the body.");
  }

  if (invoice.HasErrors || (invoice.ValidationErrors && invoice.ValidationErrors.length > 0)) {
    const validationMessages = (invoice.ValidationErrors ?? [])
      .map((e: any) => e.Message ?? JSON.stringify(e))
      .join("; ");
    throw new Error(
      `Xero accepted the request but returned validation errors: ${validationMessages}. ` +
      "The invoice was not created in Xero."
    );
  }

  return {
    xeroInvoiceId: invoice.InvoiceID,
    xeroInvoiceNumber: invoice.InvoiceNumber,
    xeroStatus: invoice.Status ?? "DRAFT",
  };
}

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
        "Xero rejected the access token (401 Unauthorised). The token may be expired or invalid. " +
        "Re-authenticate via the Xero Developer Portal and update the XERO_ACCESS_TOKEN environment variable.",
      validationErrors,
    };
  }

  if (httpStatus === 403) {
    return {
      code: 403,
      message:
        "Xero returned 403 Forbidden. The OAuth application may not have the 'accounting.transactions' write scope. " +
        "Check OAuth app permissions in the Xero Developer Portal.",
      validationErrors,
    };
  }

  if (httpStatus === 400) {
    const msg =
      validationErrors.length > 0
        ? `Xero validation failed: ${validationErrors.join("; ")}`
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
