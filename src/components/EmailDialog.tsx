import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  role: string;
  onEmailSent: (emailContent: string) => void;
}

export function EmailDialog({
  open,
  onOpenChange,
  companyName,
  contactPerson,
  contactEmail,
  role,
  onEmailSent,
}: EmailDialogProps) {
  const [subject, setSubject] = useState(`Executive Opportunity - ${role}`);
  const [emailContent, setEmailContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const generateEmail = async (emailType: "introduction" | "followup") => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          companyName,
          contactPerson,
          role,
          emailType,
        },
      });

      if (error) throw error;

      setEmailContent(data.emailContent);
      toast.success("Email content generated!");
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Failed to generate email content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = () => {
    if (!emailContent.trim() || !subject.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSending(true);
    
    // Simulate sending email
    setTimeout(() => {
      const fullEmail = `Subject: ${subject}\n\nTo: ${contactEmail}\n\n${emailContent}`;
      onEmailSent(fullEmail);
      toast.success("Email sent and logged as comment!");
      setEmailContent("");
      setSubject(`Executive Opportunity - ${role}`);
      setIsSending(false);
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email to {contactPerson}</DialogTitle>
          <DialogDescription>
            {companyName} - {role}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">To</Label>
            <Input
              id="recipient"
              value={contactEmail}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Email Content</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => generateEmail("introduction")}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="ml-2">Generate Introduction</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => generateEmail("followup")}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="ml-2">Generate Follow-up</span>
                </Button>
              </div>
            </div>
            <Textarea
              id="content"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Write your email here or use AI to generate content..."
              className="min-h-[300px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || !emailContent.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Send Email</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
