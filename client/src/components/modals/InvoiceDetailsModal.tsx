"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { BillingItem } from "@/components/BillingSection";

interface BusinessProfile {
  businessName?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  description?: string;
  timeZone?: string;
}

interface JobForInvoice {
  address: string;
  jobName?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
}

interface InvoiceDetailsModalProps {
  open: boolean;
  onClose: () => void;
  job: JobForInvoice | null;
  billingItems: BillingItem[];
  invoiceStatus: string;
  xeroInvoiceId?: string | null;
  xeroInvoiceNumber?: string | null;
  dueDate?: string; // ISO date string
  /** When set, show "Update invoice" to sync Xero with current job billing items (e.g. after adding products). */
  onUpdateInvoice?: () => Promise<void>;
  isUpdatingInvoice?: boolean;
  /** Increment to refetch the invoice PDF (e.g. after updating the invoice). */
  invoiceRefreshKey?: number;
}

export function InvoiceDetailsModal({
  open,
  onClose,
  job,
  billingItems,
  invoiceStatus,
  xeroInvoiceId,
  xeroInvoiceNumber,
  dueDate: dueDateProp,
  onUpdateInvoice,
  isUpdatingInvoice = false,
  invoiceRefreshKey = 0,
}: InvoiceDetailsModalProps) {
  const { data: settings } = useQuery<{ businessProfile?: BusinessProfile | null }>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);

  const businessProfile = settings?.businessProfile ?? {};
  const issueDate = new Date();

  // Fetch Xero invoice PDF when modal opens and we have a Xero invoice ID
  useEffect(() => {
    if (!open || !xeroInvoiceId) {
      setPdfUrl(null);
      setPdfError(false);
      return;
    }
    setPdfLoading(true);
    setPdfError(false);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setPdfError(true);
          return;
        }
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/xero/invoices/${encodeURIComponent(xeroInvoiceId)}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setPdfError(true);
          return;
        }
        const blob = await res.blob();
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = URL.createObjectURL(blob);
        setPdfUrl(pdfUrlRef.current);
      } catch {
        setPdfError(true);
      } finally {
        setPdfLoading(false);
      }
    })();
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
      setPdfUrl(null);
    };
  }, [open, xeroInvoiceId, invoiceRefreshKey]);
  const dueDate = dueDateProp
    ? new Date(dueDateProp)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const subtotal = billingItems.reduce((sum, i) => sum + i.amount, 0);
  const taxTotal = billingItems.reduce(
    (sum, i) => sum + (i.amount * i.taxRate) / 100,
    0
  );
  const total = subtotal + taxTotal;

  const reference = job?.jobName?.trim() || job?.address?.trim() || "—";
  const billingContactName = job?.customer
    ? [job.customer.company || "", [job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ")].filter(Boolean).join(" — ") || "—"
    : "—";

  const statusLabel = invoiceStatus === "draft" ? "Draft" : invoiceStatus === "sent" ? "Sent" : invoiceStatus === "paid" ? "Paid" : "Draft";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Invoice Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0">
          {/* Left: Form / Details */}
          <ScrollArea className="border-r p-6">
            <div className="space-y-6 pr-4">
              <h2 className="text-lg font-semibold">Invoice Details</h2>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Contact</label>
                <p className="mt-1 text-sm font-medium">{billingContactName}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference</label>
                <p className="mt-1 text-sm font-medium">{reference}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</label>
                <p className="mt-1 text-sm font-medium">{format(dueDate, "EEE, d MMM yy")}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Billing Items</label>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-right p-2 font-medium w-12">Qty</th>
                        <th className="text-right p-2 font-medium w-20">Price</th>
                        <th className="text-right p-2 font-medium w-14">Tax</th>
                        <th className="text-right p-2 font-medium w-20">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingItems.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">${item.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.taxRate}%</td>
                          <td className="p-2 text-right">${item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>AUD ${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (GST)</span>
                    <span>AUD ${taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>AUD ${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <div className="mt-1">
                  <Badge variant="secondary">{statusLabel}</Badge>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Right: Preview — Xero PDF when available, else static preview */}
          <ScrollArea className="bg-muted/30 p-6">
            <div className="space-y-6 pr-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Preview</h2>
                <Badge variant="outline">Invoice {statusLabel}</Badge>
              </div>

              {pdfLoading && xeroInvoiceId && (
                <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/50 py-16 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin mb-3" />
                  <p className="text-sm">Loading invoice PDF from Xero…</p>
                </div>
              )}

              {pdfError && xeroInvoiceId && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                  Could not load PDF from Xero. Showing summary below. You can open the invoice in Xero with the button below.
                </p>
              )}

              {pdfUrl && (
                <div className="rounded-lg border bg-white overflow-hidden min-h-[480px]">
                  <iframe
                    title="Invoice PDF from Xero"
                    src={pdfUrl}
                    className="w-full min-h-[520px] border-0"
                    style={{ height: "min(80vh, 720px)" }}
                  />
                </div>
              )}

              {(!xeroInvoiceId || !pdfUrl) && !pdfLoading && (
                <div className="bg-white rounded-lg border shadow-sm p-6 text-sm">
                  {/* Static preview when no Xero PDF */}
                  <div className="uppercase font-bold text-base tracking-wide text-primary mb-1">
                    {businessProfile.businessName || "Business Name"}
                  </div>
                  <div className="text-muted-foreground space-y-0.5 mb-4">
                    {businessProfile.address && <div>{businessProfile.address}</div>}
                    {businessProfile.phone && <div>{businessProfile.phone}</div>}
                    {businessProfile.email && <div>{businessProfile.email}</div>}
                    {businessProfile.website && <div>{businessProfile.website}</div>}
                  </div>

                  <div className="text-xl font-semibold mb-4">TAX INVOICE</div>

                  <div className="bg-slate-800 text-white px-4 py-2 rounded flex flex-wrap gap-x-6 gap-y-1 text-xs mb-4">
                    <span>Issue Date: {format(issueDate, "dd MMM yyyy")}</span>
                    <span>Due Date: {format(dueDate, "dd MMM yyyy")}</span>
                    <span>Invoice No: {xeroInvoiceNumber ?? "Draft"}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bill To:</div>
                      <div className="font-medium">{billingContactName}</div>
                      {job?.customer?.email && <div className="text-muted-foreground text-xs">{job.customer.email}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reference</div>
                      <div className="font-medium">{reference}</div>
                    </div>
                  </div>

                  <div className="text-2xl font-bold mb-4">Amount Due: ${total.toFixed(2)} AUD</div>

                  <div className="rounded border overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-2 font-medium">Description</th>
                          <th className="text-right p-2 font-medium w-14">Qty</th>
                          <th className="text-right p-2 font-medium w-20">Rate</th>
                          <th className="text-right p-2 font-medium w-14">GST</th>
                          <th className="text-right p-2 font-medium w-20">Price AUD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingItems.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="p-2">{item.name}</td>
                            <td className="p-2 text-right">{item.quantity.toFixed(2)}</td>
                            <td className="p-2 text-right">{item.unitPrice.toFixed(2)}</td>
                            <td className="p-2 text-right">{item.taxRate}%</td>
                            <td className="p-2 text-right">{item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 text-sm border-t pt-2">
                    <div className="flex justify-between">
                      <span>SUB TOTAL</span>
                      <span>{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST {billingItems[0]?.taxRate ?? 10}%</span>
                      <span>{taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>INVOICE TOTAL</span>
                      <span>{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>TOTAL NET PAYMENTS</span>
                      <span>0.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2">
                      <span>BALANCE DUE</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t p-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {onUpdateInvoice && xeroInvoiceId && (
            <Button
              variant="secondary"
              onClick={() => onUpdateInvoice()}
              disabled={isUpdatingInvoice}
            >
              {isUpdatingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Update invoice
                </>
              )}
            </Button>
          )}
          {xeroInvoiceId ? (
            <Button asChild>
              <a
                href={`https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroInvoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View in Xero
              </a>
            </Button>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
