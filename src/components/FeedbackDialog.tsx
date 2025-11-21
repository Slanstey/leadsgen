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
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  contactPerson: string;
  onFeedbackSubmit: (quality: "good" | "bad", reason: string) => void;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  companyName,
  contactPerson,
  onFeedbackSubmit,
}: FeedbackDialogProps) {
  const [quality, setQuality] = useState<"good" | "bad" | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!quality) {
      toast.error("Please select whether this is a good or bad lead");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for your feedback");
      return;
    }

    setIsSubmitting(true);
    
    // Small delay to show loading state
    setTimeout(() => {
      onFeedbackSubmit(quality, reason.trim());
      setQuality(null);
      setReason("");
      setIsSubmitting(false);
      onOpenChange(false);
    }, 300);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setQuality(null);
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Provide Feedback on Lead</DialogTitle>
          <DialogDescription>
            {companyName} - {contactPerson}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Lead Quality</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={quality === "good" ? "default" : "outline"}
                className={`flex-1 h-12 ${
                  quality === "good"
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : ""
                }`}
                onClick={() => setQuality("good")}
                disabled={isSubmitting}
              >
                <ThumbsUp className="h-5 w-5 mr-2" />
                Good Lead
              </Button>
              <Button
                type="button"
                variant={quality === "bad" ? "default" : "outline"}
                className={`flex-1 h-12 ${
                  quality === "bad"
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : ""
                }`}
                onClick={() => setQuality("bad")}
                disabled={isSubmitting}
              >
                <ThumbsDown className="h-5 w-5 mr-2" />
                Bad Lead
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for your feedback (e.g., No connections and company is too small)"
              className="min-h-[120px] resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !quality || !reason.trim()}
              className={
                quality === "good"
                  ? "bg-success hover:bg-success/90"
                  : quality === "bad"
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

