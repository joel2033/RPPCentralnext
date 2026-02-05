import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Check, ArrowRight, Save } from "lucide-react";

interface XeroConfig {
  invoiceTrigger?: string;
  invoiceStatus?: string;
  customerMappings?: Record<string, string>;
  productMappings?: Record<string, { accountCode: string; taxType: string }>;
}

interface XeroConfigSectionProps {
  /** When set, the parent (e.g. Settings) can trigger save from its main Save button. Pass null to unregister. */
  onRegisterSave?: (handler: (() => void) | null) => void;
  /** When true, render without outer Card (e.g. inside a sheet/dialog). */
  embedded?: boolean;
  /** Optional callback when config is closed (e.g. after save in embedded mode). */
  onClose?: () => void;
}

export function XeroConfigSection({ onRegisterSave, embedded, onClose }: XeroConfigSectionProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<XeroConfig>({
    queryKey: ["/api/xero/config"],
  });
  const { data: customers = [], isLoading: customersLoading } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });
  const { data: xeroContacts = [], isLoading: contactsLoading } = useQuery<
    Array<{ contactId: string; name: string }>
  >({
    queryKey: ["/api/xero/contacts"],
  });
  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });
  const { data: xeroAccounts = [], isLoading: accountsLoading } = useQuery<
    Array<{ accountCode: string; name: string }>
  >({
    queryKey: ["/api/xero/accounts"],
  });
  const { data: xeroTaxRates = [], isLoading: taxRatesLoading } = useQuery<
    Array<{ taxType: string; name: string }>
  >({
    queryKey: ["/api/xero/tax-rates"],
  });

  const [localConfig, setLocalConfig] = useState<XeroConfig>({});
  const latestConfigRef = useRef<XeroConfig>({});
  const hasChangesRef = useRef(false);
  useEffect(() => {
    latestConfigRef.current = localConfig;
  }, [localConfig]);
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);
  useEffect(() => {
    if (config) {
      setLocalConfig({
        invoiceTrigger: config.invoiceTrigger ?? "manual_only",
        invoiceStatus: config.invoiceStatus ?? "DRAFT",
        customerMappings: config.customerMappings ?? {},
        productMappings: config.productMappings ?? {},
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: XeroConfig) => {
      const payload = {
        invoiceTrigger: data.invoiceTrigger ?? "manual_only",
        invoiceStatus: data.invoiceStatus ?? "DRAFT",
        customerMappings: data.customerMappings ?? {},
        productMappings: data.productMappings ?? {},
      };
      const res = await apiRequest("/api/xero/config", "PUT", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/config"] });
      setHasChanges(false);
      toast({ title: "Xero configuration saved" });
      onClose?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(latestConfigRef.current);
  };

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(() => {
      if (hasChangesRef.current) saveMutation.mutate(latestConfigRef.current);
    });
    return () => onRegisterSave?.(null as any);
  }, [onRegisterSave]);

  const setCustomerMapping = (customerId: string, contactId: string) => {
    setLocalConfig((prev) => {
      const next = { ...(prev.customerMappings ?? {}) };
      if (contactId) {
        next[customerId] = contactId;
      } else {
        delete next[customerId];
      }
      return { ...prev, customerMappings: next };
    });
    setHasChanges(true);
  };

  const setProductMapping = (
    productId: string,
    field: "accountCode" | "taxType",
    value: string
  ) => {
    setLocalConfig((prev) => {
      const existing = prev.productMappings?.[productId] ?? { accountCode: "", taxType: "" };
      const next = { ...(prev.productMappings ?? {}), [productId]: { ...existing, [field]: value || "" } };
      return { ...prev, productMappings: next };
    });
    setHasChanges(true);
  };

  const setInvoiceTrigger = (v: string) => {
    setLocalConfig((prev) => ({ ...prev, invoiceTrigger: v }));
    setHasChanges(true);
  };
  const setInvoiceStatus = (v: string) => {
    setLocalConfig((prev) => ({ ...prev, invoiceStatus: v }));
    setHasChanges(true);
  };

  const loading = configLoading || customersLoading || contactsLoading || productsLoading || accountsLoading || taxRatesLoading;

  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading configuration…
      </div>
    ) : (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading configuration…
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayCustomers = customers.filter((c: any) => c.isActive !== false).slice(0, 20);
  const displayProducts = products.filter((p: any) => p.isActive !== false).slice(0, 20);

  const formContent = (
    <div className="space-y-8">
        {/* Invoicing Configuration */}
        <div className="space-y-4">
          <h3 className="font-medium">Invoicing Configuration</h3>
          <div className="p-4 bg-blue-50 rounded-lg text-sm text-gray-700 mb-4">
            Set when invoices should be raised in Xero based on your preferences. If you don't want invoices raised automatically, select "Never raise invoice automatically". You can still raise invoices manually from job cards.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>When should an invoice be created?</Label>
              <Select value={localConfig.invoiceTrigger ?? "manual_only"} onValueChange={setInvoiceTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never raise invoice automatically</SelectItem>
                  <SelectItem value="on_delivered">Raise invoice when job status is Delivered</SelectItem>
                  <SelectItem value="manual_only">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status of invoices raised in XERO</Label>
              <Select value={localConfig.invoiceStatus ?? "DRAFT"} onValueChange={setInvoiceStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft only</SelectItem>
                  <SelectItem value="AUTHORISED">Authorised</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Customer Mapping */}
        <div className="space-y-4">
          <h3 className="font-medium">Customer Mapping</h3>
          <p className="text-sm text-gray-600">
            Map a billing contact from Xero to your customer. If unassigned, invoices cannot be raised for that customer.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="w-8" />
                  <th className="text-left p-3 font-medium">Xero Contact</th>
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((c: any) => {
                  const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.company || c.email || "—";
                  const mappedId = localConfig.customerMappings?.[c.id] ?? (c as any).accountingContactId ?? "";
                  const isMapped = !!mappedId;
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3">{name}</td>
                      <td className="p-2">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </td>
                      <td className="p-3">
                        <Select
                          value={mappedId || "unmapped"}
                          onValueChange={(v) => setCustomerMapping(c.id, v === "unmapped" ? "" : v)}
                        >
                          <SelectTrigger className="max-w-[280px]">
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">— Unassigned —</SelectItem>
                            {xeroContacts.map((xc) => (
                              <SelectItem key={xc.contactId} value={xc.contactId}>
                                {xc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isMapped && <Check className="w-4 h-4 text-green-600 inline ml-2" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {customers.length > 20 && (
            <p className="text-sm text-gray-500">Showing first 20 customers. Map more in customer edit.</p>
          )}
        </div>

        {/* Product Mapping */}
        <div className="space-y-4">
          <h3 className="font-medium">Product Mapping</h3>
          <p className="text-sm text-gray-600">
            Align your products with Xero sales accounts and tax rates for accurate reporting.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="w-8" />
                  <th className="text-left p-3 font-medium">Xero Account</th>
                  <th className="w-8" />
                  <th className="text-left p-3 font-medium">Xero Tax</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((p: any) => {
                  const mapping = localConfig.productMappings?.[p.id] ?? { accountCode: "", taxType: "" };
                  const hasAccount = !!mapping.accountCode;
                  const hasTax = !!mapping.taxType;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-3">{p.title ?? p.name ?? "—"}</td>
                      <td className="p-2">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </td>
                      <td className="p-3">
                        <Select
                          value={mapping.accountCode || "unmapped"}
                          onValueChange={(v) => setProductMapping(p.id, "accountCode", v === "unmapped" ? "" : v)}
                        >
                          <SelectTrigger className="max-w-[220px]">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">— Unassigned —</SelectItem>
                            {xeroAccounts.map((xa) => (
                              <SelectItem key={xa.accountCode} value={xa.accountCode}>
                                {xa.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {hasAccount && <Check className="w-4 h-4 text-green-600 inline ml-2" />}
                      </td>
                      <td className="p-2">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </td>
                      <td className="p-3">
                        <Select
                          value={mapping.taxType || "unmapped"}
                          onValueChange={(v) => setProductMapping(p.id, "taxType", v === "unmapped" ? "" : v)}
                        >
                          <SelectTrigger className="max-w-[180px]">
                            <SelectValue placeholder="Select tax" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">— Unassigned —</SelectItem>
                            {xeroTaxRates.map((xt) => (
                              <SelectItem key={xt.taxType} value={xt.taxType}>
                                {xt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {hasTax && <Check className="w-4 h-4 text-green-600 inline ml-2" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {products.length > 20 && (
            <p className="text-sm text-gray-500">Showing first 20 products.</p>
          )}
        </div>

        {/* Save button at bottom - visible when user scrolls down after making changes */}
        {hasChanges && (
          <div className="sticky bottom-0 pt-6 pb-2 bg-background border-t">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save changes
            </Button>
          </div>
        )}
      </div>
  );

  if (embedded) return formContent;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Xero Configuration</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Set when invoices are raised, map customers to Xero contacts, and align products with Xero accounts and tax rates.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save changes
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {formContent}
      </CardContent>
    </Card>
  );
}
