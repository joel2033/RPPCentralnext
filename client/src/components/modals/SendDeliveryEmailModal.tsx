import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";
import type { EmailSettings } from "@/pages/Settings";

interface SendDeliveryEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    jobId?: string;
    address: string;
    deliveryToken?: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
  };
  onEmailSent?: () => void;
  onJobUpdated?: (updatedJob: { deliveryToken?: string }) => void;
}

export default function SendDeliveryEmailModal({
  open,
  onOpenChange,
  job,
  customer,
  onEmailSent,
  onJobUpdated,
}: SendDeliveryEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [deliveryLink, setDeliveryLink] = useState("");
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [tokenGenerationError, setTokenGenerationError] = useState<string | null>(null);
  const [retryTokenGeneration, setRetryTokenGeneration] = useState(0);
  const { toast } = useToast();

  const { data: settings } = useQuery<{ emailSettings?: EmailSettings }>({
    queryKey: ["/api/settings"],
    enabled: open,
  });
  const deliveryDefaults = settings?.emailSettings?.deliveryEmail;

  // Generate delivery link from deliveryToken (required for security)
  useEffect(() => {
    if (job.deliveryToken) {
      const baseUrl = window.location.origin;
      setDeliveryLink(`${baseUrl}/delivery/${job.deliveryToken}`);
    } else {
      setDeliveryLink("");
    }
  }, [job.deliveryToken]);

  // Automatically generate delivery token when modal opens if missing
  useEffect(() => {
    if (open && !job.deliveryToken && !isGeneratingToken) {
      const generateToken = async () => {
        setIsGeneratingToken(true);
        setTokenGenerationError(null);
        
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) {
            throw new Error("Unable to authenticate the request.");
          }

          const jobId = job.jobId || job.id;
          const response = await fetch(`/api/jobs/${jobId}/generate-delivery-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to generate delivery token");
          }

          const data = await response.json();
          
          // Notify parent component to refresh job data
          if (onJobUpdated) {
            onJobUpdated({ deliveryToken: data.token });
          }
          
          // Update local delivery link immediately
          const baseUrl = window.location.origin;
          setDeliveryLink(`${baseUrl}/delivery/${data.token}`);
          
          toast({
            title: "Delivery token generated",
            description: "The secure delivery link has been created.",
          });
        } catch (error: any) {
          console.error("Error generating delivery token:", error);
          setTokenGenerationError(error.message || "Failed to generate delivery token");
          toast({
            title: "Failed to generate token",
            description: error.message || "Please try again or contact support",
            variant: "destructive",
          });
        } finally {
          setIsGeneratingToken(false);
        }
      };

      generateToken();
    }
  }, [open, job.deliveryToken, job.jobId, job.id, isGeneratingToken, retryTokenGeneration, onJobUpdated, toast]);

  // Pre-fill form when modal opens (use saved defaults if set)
  useEffect(() => {
    if (open) {
      setRecipientEmail(customer.email || "");
      const subjectTemplate = deliveryDefaults?.subjectTemplate?.trim() || "Your photos are ready for {address}";
      const messageTemplate = deliveryDefaults?.messageTemplate?.trim() || `Hi {customerFirstName},\n\nYour professional property photos for {address} are ready for download!\n\nClick the link below to view and download your high-resolution images:\n\n[DELIVERY_LINK]\n\nYou can download individual files or the entire collection. The files will be available for 30 days.\n\nIf you have any questions or need revisions, please don't hesitate to reach out.\n\nThank you for your business!\n\nBest regards`;
      const replacePlaceholders = (s: string) =>
        s
          .replace(/\{address\}/g, job.address || "")
          .replace(/\{customerFirstName\}/g, customer.firstName || "");
      setSubject(replacePlaceholders(subjectTemplate));
      setMessage(replacePlaceholders(messageTemplate));
      setEmailSent(false);
    }
  }, [open, customer, job.address, deliveryDefaults?.subjectTemplate, deliveryDefaults?.messageTemplate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deliveryLink);
    toast({
      title: "Link copied",
      description: "Delivery link copied to clipboard",
    });
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !subject || !message) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const updateStatus = async () => {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error("Unable to authenticate the request.");
        }

        const response = await fetch(`/api/jobs/${job.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ status: "delivered" }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update job status");
        }
      };

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Unable to authenticate the request.");
      }

      const [emailResponse] = await Promise.all([
        fetch("/api/delivery/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            jobId: job.id,
            recipientEmail,
            subject,
            message: message.replace("[DELIVERY_LINK]", deliveryLink),
          }),
        }),
        updateStatus(),
      ]);

      if (!emailResponse.ok) {
        const errData = await emailResponse.json().catch(() => ({}));
        throw new Error(errData.emailError || errData.error || "Failed to send email");
      }

      const result = await emailResponse.json();
      if (result.emailSent === false) {
        throw new Error(
          result.emailError || "The email could not be delivered. Check your email settings (e.g. SendGrid) and try again."
        );
      }

      setEmailSent(true);
      toast({
        title: "Email sent successfully",
        description: `Delivery email sent to ${recipientEmail}`,
      });

      // Call callback after short delay
      setTimeout(() => {
        onEmailSent?.();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Error sending email:", error);
      const message = error instanceof Error ? error.message : "Please try again or contact support";
      toast({
        title: "Failed to send email",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="modal-send-delivery-email">
        {!emailSent ? (
          <>
            <DialogHeader>
              <DialogTitle>Send Delivery Email</DialogTitle>
              <DialogDescription>
                Send a professional delivery email with a secure link to {customer.firstName}{" "}
                {customer.lastName} for {job.address}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Delivery Link Preview or Warning */}
              {!deliveryLink ? (
                <Alert variant={tokenGenerationError ? "destructive" : "default"}>
                  <AlertDescription>
                    {isGeneratingToken ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                        Generating secure delivery token...
                      </div>
                    ) : tokenGenerationError ? (
                      <>
                        Failed to generate delivery token: {tokenGenerationError}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setTokenGenerationError(null);
                            setRetryTokenGeneration(prev => prev + 1);
                          }}
                        >
                          Retry
                        </Button>
                      </>
                    ) : (
                      "Generating secure delivery token..."
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label>Delivery Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={deliveryLink}
                      readOnly
                      className="font-mono text-xs bg-muted"
                      data-testid="input-delivery-link"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="flex-shrink-0"
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This secure link will be automatically included in the email
                  </p>
                </div>
              )}

              {/* Recipient Email */}
              <div className="space-y-2">
                <Label htmlFor="recipient-email">
                  To <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="customer@example.com"
                  data-testid="input-recipient-email"
                />
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your photos are ready"
                  data-testid="input-subject"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                  placeholder="Enter your message..."
                  rows={10}
                  className="resize-none font-mono text-sm"
                  data-testid="textarea-message"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Use [DELIVERY_LINK] as placeholder for the delivery link</span>
                  <span>{message.length} / 1000</span>
                </div>
              </div>

              {/* Info Alert */}
              <Alert>
                <AlertDescription className="text-sm">
                  The delivery link includes a secure token that allows access to the files for 30
                  days. No login required.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={isSending || isGeneratingToken || !deliveryLink || !recipientEmail || !subject || !message}
                className="border-0 bg-[linear-gradient(30deg,rgba(242,87,44,1)_0%,rgba(245,126,97,0.5)_100%)] shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                data-testid="button-send-email"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Email Sent Successfully!</h3>
            <p className="text-muted-foreground mb-4">
              The delivery email has been sent to {recipientEmail}
            </p>
            <p className="text-sm text-muted-foreground">
              This dialog will close automatically...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
