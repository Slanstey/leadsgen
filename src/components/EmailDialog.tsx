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
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/lib/supabaseUtils";

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
  const { profile } = useAuth();
  const [subject, setSubject] = useState(`Executive Opportunity - ${role}`);
  const [emailContent, setEmailContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const generateEmail = async (emailType: "introduction" | "followup") => {
    setIsGenerating(true);
    try {
      // Fetch company details from database
      let company = null;
      if (profile?.tenant_id) {
        const { data: companyData, error: companyError } = await supabase
          .from(Tables.COMPANIES)
          .select("*")
          .eq("name", companyName)
          .eq("tenant_id", profile.tenant_id)
          .maybeSingle();

        if (!companyError && companyData) {
          company = companyData;
        }
      }

      // Build company context for the prompt
      const companyContext = company
        ? `
Company Details:
- Industry: ${company.industry || "Not specified"}
- Sub-Industry: ${company.sub_industry || "Not specified"}
- Location: ${company.location || "Not specified"}
- Annual Revenue: ${company.annual_revenue || "Not specified"}
- Description: ${company.description || "Not specified"}
`
        : `
Company Details: Limited information available
- Company Name: ${companyName}
`;

      // Build the prompt based on email type
      const emailTypeContext =
        emailType === "introduction"
          ? "an introduction email"
          : "a follow-up email";

      const userPrompt = `Write ${emailTypeContext} to ${contactPerson} at ${companyName}.

${companyContext}

Contact Details:
- Contact Person: ${contactPerson}
- Role/Title: ${role}
- Company: ${companyName}

Requirements:
- Keep it professional but warm and personable
- Reference specific details about the company (industry, location, etc.) when relevant
- Make it personalized and not generic
- For introduction emails: Introduce yourself and explain why you're reaching out
- For follow-up emails: Reference previous contact and provide additional value or next steps
- Keep the email concise (2-3 paragraphs maximum)
- Include a clear call-to-action
- Do not include subject line or email headers, just the email body content

Generate the email body now:`;

      // Call OpenAI API directly from frontend
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY not configured. Please add VITE_OPENAI_API_KEY to your .env file.");
      }

      console.log("Calling OpenAI API directly with prompt length:", userPrompt.length);

      const systemPrompt = `You are a professional email writing assistant. Write personalized, professional, and engaging emails for business outreach.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorJson.error?.code || errorText;
        } catch {
          errorDetails = errorText;
        }
        console.error("OpenAI API error:", errorDetails, "Status:", response.status);
        throw new Error(`OpenAI API error: ${errorDetails}`);
      }

      const openaiData = await response.json();

      if (!openaiData.choices || openaiData.choices.length === 0) {
        console.error("OpenAI response has no choices:", openaiData);
        throw new Error("Invalid response from OpenAI API: No choices in response");
      }

      const emailContent =
        openaiData.choices[0]?.message?.content?.trim() ||
        "I apologize, but I was unable to generate the email content. Please try again.";

      setEmailContent(emailContent);
      toast.success("Email content generated!");
    } catch (error: any) {
      console.error("Error generating email:", error);
      console.error("Error details:", {
        message: error?.message,
        error: error?.error,
        details: error?.details,
        context: error?.context,
        status: error?.status,
        fullError: error,
      });

      let errorMessage = "Failed to generate email content";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      toast.error(`Failed to generate email: ${errorMessage}`);
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
