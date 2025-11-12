import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Lead } from "@/types/lead";
import * as XLSX from "xlsx";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allLeads: Lead[];
  filteredLeads: Lead[];
}

export function ExportDialog({
  open,
  onOpenChange,
  allLeads,
  filteredLeads,
}: ExportDialogProps) {
  const [exportType, setExportType] = useState<"all" | "filtered">("filtered");
  const [format, setFormat] = useState<"csv" | "excel">("excel");
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = (leads: Lead[]) => {
    // Create CSV headers
    const headers = [
      "Company Name",
      "Contact Person",
      "Email",
      "Role",
      "Status",
      "Tier",
      "Comments Count",
      "Created At",
      "Updated At",
    ];

    // Create CSV rows
    const rows = leads.map((lead) => [
      lead.companyName,
      lead.contactPerson,
      lead.contactEmail,
      lead.role,
      lead.status,
      lead.tier.toString(),
      lead.comments.length.toString(),
      lead.createdAt.toLocaleDateString(),
      lead.updatedAt.toLocaleDateString(),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `leads_${exportType === "all" ? "all" : "filtered"}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (leads: Lead[]) => {
    // Prepare data for Excel
    const excelData = leads.map((lead) => ({
      "Company Name": lead.companyName,
      "Contact Person": lead.contactPerson,
      Email: lead.contactEmail,
      Role: lead.role,
      Status: lead.status,
      Tier: lead.tier,
      "Comments Count": lead.comments.length,
      "Created At": lead.createdAt.toLocaleDateString(),
      "Updated At": lead.updatedAt.toLocaleDateString(),
      Comments: lead.comments
        .map(
          (c) =>
            `${c.author} (${c.createdAt.toLocaleDateString()}): ${c.text}`
        )
        .join(" | "),
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Company Name
      { wch: 20 }, // Contact Person
      { wch: 30 }, // Email
      { wch: 20 }, // Role
      { wch: 15 }, // Status
      { wch: 5 }, // Tier
      { wch: 15 }, // Comments Count
      { wch: 12 }, // Created At
      { wch: 12 }, // Updated At
      { wch: 50 }, // Comments
    ];
    worksheet["!cols"] = columnWidths;

    // Write file
    XLSX.writeFile(
      workbook,
      `leads_${exportType === "all" ? "all" : "filtered"}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const handleExport = () => {
    const leadsToExport =
      exportType === "all" ? allLeads : filteredLeads;

    if (leadsToExport.length === 0) {
      toast.error("No leads to export");
      return;
    }

    setIsExporting(true);

    try {
      if (format === "csv") {
        exportToCSV(leadsToExport);
      } else {
        exportToExcel(leadsToExport);
      }

      toast.success(
        `Successfully exported ${leadsToExport.length} lead${
          leadsToExport.length === 1 ? "" : "s"
        } as ${format.toUpperCase()}`
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export leads");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Leads</DialogTitle>
          <DialogDescription>
            Choose which leads to export and the file format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Options</Label>
            <RadioGroup
              value={exportType}
              onValueChange={(value) =>
                setExportType(value as "all" | "filtered")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filtered" id="filtered" />
                <Label
                  htmlFor="filtered"
                  className="font-normal cursor-pointer flex-1"
                >
                  <div>
                    <div className="font-medium">Filtered Leads</div>
                    <div className="text-sm text-muted-foreground">
                      {filteredLeads.length} lead
                      {filteredLeads.length === 1 ? "" : "s"} (based on
                      current filters)
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label
                  htmlFor="all"
                  className="font-normal cursor-pointer flex-1"
                >
                  <div>
                    <div className="font-medium">All Leads</div>
                    <div className="text-sm text-muted-foreground">
                      {allLeads.length} lead{allLeads.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">File Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as "csv" | "excel")}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

