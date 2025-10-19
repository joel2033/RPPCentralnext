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
}

export default function SendDeliveryEmailModal({
  open,
  onOpenChange,
  job,
  customer,
  onEmailSent,
}: SendDeliveryEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [deliveryLink, setDeliveryLink] = useState("");
  const { toast } = useToast();

  // Generate delivery link from deliveryToken (required for security)
  useEffect(() => {
    if (job.deliveryToken) {
      const baseUrl = window.location.origin;
      setDeliveryLink(`${baseUrl}/delivery/${job.deliveryToken}`);
    } else {
      setDeliveryLink("");
    }
  }, [job.deliveryToken]);

  // Pre-fill form when modal opens
  useEffect(() => {
    if (open) {
      setRecipientEmail(customer.email || "");
      setSubject(`Your photos are ready for ${job.address}`);
      setMessage(
        `Hi ${customer.firstName},\n\nYour professional property photos for ${job.address} are ready for download!\n\nClick the link below to view and download your high-resolution images:\n\n[DELIVERY_LINK]\n\nYou can download individual files or the entire collection. The files will be available for 30 days.\n\nIf you have any questions or need revisions, please don't hesitate to reach out.\n\nThank you for your business!\n\nBest regards`
      );
      setEmailSent(false);
    }
  }, [open, customer, job.address]);

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
      const response = await fetch("/api/delivery/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          recipientEmail,
          subject,
          message: message.replace("[DELIVERY_LINK]", deliveryLink),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send email");
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
      toast({
        title: "Failed to send email",
        description: "Please try again or contact support",
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
                <Alert variant="destructive">
                  <AlertDescription>
                    This job does not have a secure delivery token. Please contact support to generate
                    a delivery token before sending this email.
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
                disabled={isSending || !deliveryLink || !recipientEmail || !subject || !message}
                className="bg-gradient-to-r from-primary to-primary/90"
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
