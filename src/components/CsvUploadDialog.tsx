import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Upload, Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess?: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: CsvUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    // Lead fields
    company_name: string;
    contact_person: string;
    contact_email: string;
    role: string;
    status: string;
    tier: string;
    tier_reason: string;
    warm_connections: string;
    // Company fields
    company_location: string;
    company_industry: string;
    company_sub_industry: string;
    company_annual_revenue: string;
    company_description: string;
  }>({
    company_name: "",
    contact_person: "",
    contact_email: "",
    role: "",
    status: "",
    tier: "",
    tier_reason: "",
    warm_connections: "",
    company_location: "",
    company_industry: "",
    company_sub_industry: "",
    company_annual_revenue: "",
    company_description: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);

  const requiredLeadFields = [
    { key: "company_name", label: "Company Name" },
    { key: "contact_person", label: "Contact Person" },
    { key: "contact_email", label: "Contact Email" },
    { key: "role", label: "Role" },
  ];

  const optionalLeadFields = [
    { key: "status", label: "Status", required: false },
    { key: "tier", label: "Tier (good/medium/bad)", required: false },
    { key: "tier_reason", label: "Tier Reason", required: false },
    { key: "warm_connections", label: "Warm Connections", required: false },
  ];

  const optionalCompanyFields = [
    { key: "company_location", label: "Company Location (City, Country)", required: true },
    { key: "company_industry", label: "Company Industry", required: true },
    { key: "company_sub_industry", label: "Company Sub-Industry", required: true },
    { key: "company_annual_revenue", label: "Company Annual Revenue", required: true },
    { key: "company_description", label: "Company Description", required: true },
  ];

  // Function to classify a lead using the backend API
  const classifyLead = async (leadId: string, tenantId: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/classify-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: leadId,
          tenant_id: tenantId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[CSV Upload] Lead ${leadId} classified as ${result.classification.tier}`);
    } catch (error) {
      console.error(`[CSV Upload] Error classifying lead ${leadId}:`, error);
      // Don't throw - classification failure shouldn't block the upload
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        console.log("[CSV Upload] No file selected");
        return;
      }

      console.log("[CSV Upload] File selected:", selectedFile.name, "Size:", selectedFile.size);

      // Validate file type
      const validExtensions = [".csv", ".xlsx", ".xls"];
      const fileExtension = selectedFile.name
        .toLowerCase()
        .substring(selectedFile.name.lastIndexOf("."));

      console.log("[CSV Upload] File extension:", fileExtension);

      if (!validExtensions.includes(fileExtension)) {
        console.error("[CSV Upload] Invalid file extension:", fileExtension);
        toast.error("Please upload a CSV or Excel file");
        return;
      }

      console.log("[CSV Upload] Setting file state...");
      setFile(selectedFile);

      console.log("[CSV Upload] Reading file data...");
      const fileData = await selectedFile.arrayBuffer();
      console.log("[CSV Upload] File data read, size:", fileData.byteLength);

      console.log("[CSV Upload] Parsing workbook...");
      const workbook = XLSX.read(fileData, { type: "array" });
      console.log("[CSV Upload] Workbook parsed, sheets:", workbook.SheetNames);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.error("[CSV Upload] No sheets found in workbook");
        toast.error("The file appears to have no sheets");
        return;
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      console.log("[CSV Upload] Converting sheet to JSON...");
      const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet);
      console.log("[CSV Upload] JSON data parsed, rows:", jsonData.length);

      if (jsonData.length === 0) {
        console.error("[CSV Upload] No data rows found");
        toast.error("The file appears to be empty");
        return;
      }

      // Get headers from first row
      const firstRow = jsonData[0];
      const csvHeaders = Object.keys(firstRow);
      console.log("[CSV Upload] Headers found:", csvHeaders);

      console.log("[CSV Upload] Setting headers state...");
      setHeaders(csvHeaders);

      console.log("[CSV Upload] Setting parsed data state...");
      setParsedData(jsonData);

      // Show preview (first 5 rows)
      console.log("[CSV Upload] Setting preview rows...");
      setPreviewRows(jsonData.slice(0, 5));

      // Auto-detect column mapping based on common column names
      console.log("[CSV Upload] Auto-detecting column mappings...");
      const autoMapping = {
        company_name: "",
        contact_person: "",
        contact_email: "",
        role: "",
        company_location: "",
        company_industry: "",
        company_sub_industry: "",
        company_annual_revenue: "",
        company_description: "",
      } as typeof columnMapping;

      csvHeaders.forEach((header) => {
        const lowerHeader = header.toLowerCase().trim();

        // Company name mappings
        if (
          !autoMapping.company_name &&
          (lowerHeader.includes("company") ||
            lowerHeader.includes("organization") ||
            lowerHeader.includes("firm") ||
            lowerHeader === "company name")
        ) {
          autoMapping.company_name = header;
        }

        // Contact person mappings
        if (
          !autoMapping.contact_person &&
          (lowerHeader.includes("contact") && lowerHeader.includes("name") ||
            lowerHeader.includes("contact person") ||
            lowerHeader.includes("person name") ||
            (lowerHeader.includes("name") && !lowerHeader.includes("company")))
        ) {
          autoMapping.contact_person = header;
        }

        // Email mappings
        if (
          !autoMapping.contact_email &&
          (lowerHeader.includes("email") ||
            lowerHeader.includes("e-mail") ||
            lowerHeader.includes("mail"))
        ) {
          autoMapping.contact_email = header;
        }

        // Role mappings
        if (
          !autoMapping.role &&
          (lowerHeader.includes("role") ||
            lowerHeader.includes("title") ||
            lowerHeader.includes("position") ||
            lowerHeader.includes("job"))
        ) {
          autoMapping.role = header;
        }

        // Company location mappings
        if (
          !autoMapping.company_location &&
          (lowerHeader.includes("location") ||
            lowerHeader.includes("address") ||
            lowerHeader.includes("city") ||
            lowerHeader.includes("country"))
        ) {
          autoMapping.company_location = header;
        }

        // Company industry mappings
        if (
          !autoMapping.company_industry &&
          (lowerHeader.includes("industry") && !lowerHeader.includes("sub"))
        ) {
          autoMapping.company_industry = header;
        }

        // Company sub-industry mappings
        if (
          !autoMapping.company_sub_industry &&
          (lowerHeader.includes("sub") && lowerHeader.includes("industry") ||
            lowerHeader.includes("subindustry") ||
            lowerHeader.includes("sector"))
        ) {
          autoMapping.company_sub_industry = header;
        }

        // Company annual revenue mappings
        if (
          !autoMapping.company_annual_revenue &&
          (lowerHeader.includes("revenue") ||
            lowerHeader.includes("annual revenue") ||
            lowerHeader.includes("revenue range"))
        ) {
          autoMapping.company_annual_revenue = header;
        }

        // Company description mappings
        if (
          !autoMapping.company_description &&
          (lowerHeader.includes("description") ||
            lowerHeader.includes("about") ||
            lowerHeader.includes("summary") ||
            lowerHeader.includes("overview"))
        ) {
          autoMapping.company_description = header;
        }
      });

      console.log("[CSV Upload] Auto-mapping result:", autoMapping);
      console.log("[CSV Upload] Setting column mapping state...");
      setColumnMapping(autoMapping);
      console.log("[CSV Upload] File processing completed successfully");
    } catch (error: any) {
      console.error("[CSV Upload] Error parsing file:", error);
      console.error("[CSV Upload] Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      toast.error(`Failed to parse file: ${error?.message || "Unknown error"}`);
      // Reset file input on error
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFile(null);
    }
  };

  const handleUpload = async () => {
    console.log("[CSV Upload] Starting upload process...");
    console.log("[CSV Upload] Column mapping:", columnMapping);
    console.log("[CSV Upload] Parsed data rows:", parsedData.length);

    // Validate mapping
    const missingFields = requiredLeadFields.filter(
      (field) => !columnMapping[field.key as keyof typeof columnMapping]
    );

    if (missingFields.length > 0) {
      console.error("[CSV Upload] Missing required fields:", missingFields);
      toast.error(
        `Please map the following required fields: ${missingFields.map((f) => f.label).join(", ")}`
      );
      return;
    }

    if (parsedData.length === 0) {
      console.error("[CSV Upload] No parsed data to upload");
      toast.error("No data to upload");
      return;
    }

    console.log("[CSV Upload] Setting uploading state to true");
    setIsUploading(true);

    try {
      // Prepare data for processing
      const processedData = parsedData
        .map((row) => {
          const companyName = row[columnMapping.company_name]?.toString().trim() || "";
          const contactPerson = row[columnMapping.contact_person]?.toString().trim() || "";
          const contactEmail = row[columnMapping.contact_email]?.toString().trim() || "";
          const role = row[columnMapping.role]?.toString().trim() || "";

          // Skip rows with missing required lead fields
          if (!companyName || !contactPerson || !contactEmail || !role) {
            return null;
          }

          // Extract optional lead fields
          const statusRaw = columnMapping.status
            ? row[columnMapping.status]?.toString().trim().toLowerCase() || ""
            : "";
          // Map status values to valid enum values (excluding "ignored" as it's not in Supabase enum)
          let status: "not_contacted" | "contacted" | "qualified" | "in_progress" | "closed_won" | "closed_lost" = "not_contacted";
          if (statusRaw) {
            const statusMap: Record<string, "not_contacted" | "contacted" | "qualified" | "in_progress" | "closed_won" | "closed_lost"> = {
              "not_contacted": "not_contacted",
              "not contacted": "not_contacted",
              "contacted": "contacted",
              "qualified": "qualified",
              "in_progress": "in_progress",
              "in progress": "in_progress",
              "closed_won": "closed_won",
              "closed won": "closed_won",
              "closed_lost": "closed_lost",
              "closed lost": "closed_lost",
              "ignored": "not_contacted", // Map ignored to not_contacted since it's not in Supabase enum
            };
            status = statusMap[statusRaw] || "not_contacted";
          }

          const tierRaw = columnMapping.tier
            ? row[columnMapping.tier]?.toString().trim().toLowerCase() || ""
            : "";
          // Map tier values to valid enum values
          let tier: "good" | "medium" | "bad" = "medium";
          if (tierRaw) {
            const tierMap: Record<string, "good" | "medium" | "bad"> = {
              "good": "good",
              "medium": "medium",
              "bad": "bad",
              "1": "good",
              "2": "medium",
              "3": "bad",
            };
            tier = tierMap[tierRaw] || "medium";
          }

          const tierReason = columnMapping.tier_reason
            ? row[columnMapping.tier_reason]?.toString().trim() || ""
            : "";

          const warmConnections = columnMapping.warm_connections
            ? row[columnMapping.warm_connections]?.toString().trim() || ""
            : "";

          // Extract company fields (use defaults if not mapped)
          // Extract city and country from location/address field
          const companyLocationRaw = columnMapping.company_location
            ? row[columnMapping.company_location]?.toString().trim() || ""
            : "";

          // Helper function to extract city and country
          const extractCityCountry = (address: string): string => {
            if (!address) return "";
            const parts = address.split(",").map(p => p.trim());
            if (parts.length <= 2) {
              return parts.join(", ");
            }
            // If 3+ parts, take last two (city, country) or skip state if detected
            if (parts.length >= 2) {
              const lastPart = parts[parts.length - 1];
              const secondLastPart = parts[parts.length - 2];
              // Check if second last is a state abbreviation (2 letters)
              const isState = /^[A-Z]{2}$/i.test(secondLastPart);
              if (isState && parts.length >= 3) {
                return `${parts[parts.length - 3]}, ${lastPart}`;
              }
              return `${secondLastPart}, ${lastPart}`;
            }
            return parts[parts.length - 1];
          };

          const companyLocation = extractCityCountry(companyLocationRaw);
          const companyIndustry = columnMapping.company_industry
            ? row[columnMapping.company_industry]?.toString().trim() || "Unknown"
            : "Unknown";
          const companySubIndustry = columnMapping.company_sub_industry
            ? row[columnMapping.company_sub_industry]?.toString().trim() || ""
            : "";
          const companyAnnualRevenue = columnMapping.company_annual_revenue
            ? row[columnMapping.company_annual_revenue]?.toString().trim() || ""
            : "";
          const companyDescription = columnMapping.company_description
            ? row[columnMapping.company_description]?.toString().trim() || ""
            : "";

          return {
            company: {
              name: companyName,
              location: companyLocation,
              industry: companyIndustry,
              sub_industry: companySubIndustry,
              annual_revenue: companyAnnualRevenue,
              description: companyDescription,
            },
            lead: {
              tenant_id: tenantId,
              company_name: companyName,
              contact_person: contactPerson,
              contact_email: contactEmail,
              role: role,
              status: status as any,
              tier: tier as any,
              ...(tierReason && { tier_reason: tierReason }),
              ...(warmConnections && { warm_connections: warmConnections }),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
          };
        })
        .filter((item) => item !== null) as Array<{
          company: {
            name: string;
            location: string;
            industry: string;
            sub_industry: string;
            annual_revenue: string;
            description: string;
          };
          lead: {
            tenant_id: string;
            company_name: string;
            contact_person: string;
            contact_email: string;
            role: string;
            status: "not_contacted" | "contacted" | "qualified" | "in_progress" | "closed_won" | "closed_lost" | "ignored";
            tier: "good" | "medium" | "bad";
            tier_reason?: string;
            warm_connections?: string;
            created_at: string;
            updated_at: string;
          };
        }>;

      if (processedData.length === 0) {
        toast.error("No valid leads found. Please ensure all required fields are filled.");
        setIsUploading(false);
        return;
      }

      // Track unique companies by name
      const companyMap = new Map<string, { id: string; created: boolean }>();
      let companiesCreated = 0;
      let companiesSkipped = 0;
      let companiesFailed = 0;
      let leadsCreated = 0;
      let leadsSkipped = 0;

      // Process in batches
      const batchSize = 50;

      for (let i = 0; i < processedData.length; i += batchSize) {
        const batch = processedData.slice(i, i + batchSize);

        // First, ensure all companies exist
        for (const item of batch) {
          const companyName = item.company.name;

          if (!companyMap.has(companyName)) {
            try {
              // Check if company already exists
              const { data: existingCompany } = await supabase
                .from("companies")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("name", companyName)
                .limit(1)
                .maybeSingle();

              if (existingCompany) {
                companyMap.set(companyName, { id: existingCompany.id, created: false });
                companiesSkipped++;
              } else {
                // Create new company - ensure all required fields have valid values
                const companyInsert = {
                  tenant_id: tenantId,
                  name: companyName,
                  location: item.company.location || "",
                  industry: item.company.industry || "Unknown",
                  sub_industry: item.company.sub_industry || "",
                  annual_revenue: item.company.annual_revenue || "",
                  description: item.company.description || "",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                let newCompany = null;
                let companyError = null;

                // Try to create company, with retry logic for race conditions
                for (let retry = 0; retry < 2; retry++) {
                  const { data, error } = await supabase
                    .from("companies")
                    .insert(companyInsert)
                    .select()
                    .single();

                  if (error) {
                    // If it's a unique constraint violation, the company might have been created by another batch
                    // Check again if it exists
                    if (error.code === "23505" || error.message?.includes("duplicate")) {
                      const { data: retryCompany } = await supabase
                        .from("companies")
                        .select("id")
                        .eq("tenant_id", tenantId)
                        .eq("name", companyName)
                        .limit(1)
                        .maybeSingle();

                      if (retryCompany) {
                        companyMap.set(companyName, { id: retryCompany.id, created: false });
                        companiesSkipped++;
                        break;
                      }
                    }

                    companyError = error;
                    if (retry === 0) {
                      // Wait a bit before retrying
                      await new Promise(resolve => setTimeout(resolve, 100));
                      continue;
                    }
                  } else {
                    newCompany = data;
                    break;
                  }
                }

                if (companyError && !newCompany) {
                  console.error("[CSV Upload] Error creating company after retries:", companyError);
                  console.error("[CSV Upload] Company error details:", {
                    message: companyError?.message,
                    code: companyError?.code,
                    details: companyError?.details,
                    companyName: companyName,
                    companyData: companyInsert,
                  });
                  // Mark this company as failed so we skip creating leads for it
                  companyMap.set(companyName, { id: "", created: false });
                  companiesFailed++;
                } else if (newCompany) {
                  console.log("[CSV Upload] Company created:", newCompany.id, companyName);
                  companyMap.set(companyName, { id: newCompany.id, created: true });
                  companiesCreated++;
                }
              }
            } catch (err: any) {
              console.error("[CSV Upload] Error processing company:", err);
              console.error("[CSV Upload] Company processing error:", {
                message: err?.message,
                companyName: companyName,
              });
              // Mark this company as failed so we skip creating leads for it
              companyMap.set(companyName, { id: "", created: false });
              companiesFailed++;
            }
          }
        }

        // Now create leads - only for companies that were successfully created or already exist
        const leadsToInsert = batch
          .filter((item) => {
            const companyInfo = companyMap.get(item.company.name);
            // Only include leads if the company exists (has a valid ID)
            return companyInfo && companyInfo.id;
          })
          .map((item) => item.lead);

        try {
          const { data: insertedLeads, error: leadsError } = await supabase
            .from("leads")
            .insert(leadsToInsert as any)
            .select();

          if (leadsError) {
            // If it's a unique constraint violation, try inserting one by one
            if (leadsError.code === "23505") {
              // Insert individually to handle duplicates
              for (const lead of leadsToInsert) {
                try {
                  // Double-check that the company exists before creating the lead
                  const companyInfo = companyMap.get(lead.company_name);
                  if (!companyInfo || !companyInfo.id) {
                    console.warn("[CSV Upload] Skipping lead - company not found:", lead.company_name);
                    leadsSkipped++;
                    continue;
                  }

                  // Check if lead already exists
                  const { data: existingLead } = await supabase
                    .from("leads")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .eq("company_name", lead.company_name)
                    .eq("contact_person", lead.contact_person)
                    .limit(1)
                    .maybeSingle();

                  if (!existingLead) {
                    const { data: newLead } = await supabase.from("leads").insert(lead as any).select().single();
                    if (newLead) {
                      leadsCreated++;
                      // Classify lead asynchronously (don't await to avoid blocking)
                      classifyLead(newLead.id, tenantId).catch(err => {
                        console.error("[CSV Upload] Error classifying lead:", err);
                      });
                    }
                  } else {
                    leadsSkipped++;
                  }
                } catch (err: any) {
                  console.error("[CSV Upload] Error inserting individual lead:", err);
                  console.error("[CSV Upload] Lead error details:", {
                    message: err?.message,
                    code: err?.code,
                  });
                  leadsSkipped++;
                }
              }
            } else {
              throw leadsError;
            }
          } else {
            leadsCreated += insertedLeads?.length || 0;
            // Classify all inserted leads asynchronously
            if (insertedLeads && insertedLeads.length > 0) {
              insertedLeads.forEach((lead: any) => {
                classifyLead(lead.id, tenantId).catch(err => {
                  console.error("[CSV Upload] Error classifying lead:", err);
                });
              });
            }
          }
        } catch (error: any) {
          console.error("[CSV Upload] Error inserting leads batch:", error);
          console.error("[CSV Upload] Batch error details:", {
            message: error?.message,
            code: error?.code,
            batchSize: leadsToInsert.length,
          });
          // Continue with next batch
        }
      }

      // Build success message
      const messages: string[] = [];
      if (companiesCreated > 0) {
        messages.push(`${companiesCreated} compan${companiesCreated === 1 ? "y" : "ies"} created`);
      }
      if (companiesSkipped > 0) {
        messages.push(`${companiesSkipped} compan${companiesSkipped === 1 ? "y" : "ies"} already existed`);
      }
      if (companiesFailed > 0) {
        messages.push(`${companiesFailed} compan${companiesFailed === 1 ? "y" : "ies"} failed (leads skipped)`);
      }
      if (leadsCreated > 0) {
        messages.push(`${leadsCreated} lead${leadsCreated === 1 ? "" : "s"} created`);
      }
      if (leadsSkipped > 0) {
        messages.push(`${leadsSkipped} lead${leadsSkipped === 1 ? "" : "s"} skipped (duplicates)`);
      }

      if (companiesFailed > 0) {
        toast.warning(`Upload completed with issues: ${messages.join(", ")}`);
      } else {
        toast.success(`Successfully uploaded: ${messages.join(", ")}`);
      }

      // Reset state
      setFile(null);
      setParsedData([]);
      setHeaders([]);
      setColumnMapping({
        company_name: "",
        contact_person: "",
        contact_email: "",
        role: "",
        status: "",
        tier: "",
        tier_reason: "",
        warm_connections: "",
        company_location: "",
        company_industry: "",
        company_sub_industry: "",
        company_annual_revenue: "",
        company_description: "",
      });
      setPreviewRows([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("[CSV Upload] Error uploading leads:", error);
      console.error("[CSV Upload] Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
      });
      toast.error(error.message || "Failed to upload leads");
    } finally {
      console.log("[CSV Upload] Setting uploading state to false");
      setIsUploading(false);
    }
  };

  const handleClose = (open: boolean) => {
    console.log("[CSV Upload] Dialog close requested, open:", open, "isUploading:", isUploading);
    if (!open && !isUploading) {
      console.log("[CSV Upload] Resetting state and closing dialog");
      setFile(null);
      setParsedData([]);
      setHeaders([]);
      setColumnMapping({
        company_name: "",
        contact_person: "",
        contact_email: "",
        role: "",
        status: "",
        tier: "",
        tier_reason: "",
        warm_connections: "",
        company_location: "",
        company_industry: "",
        company_sub_industry: "",
        company_annual_revenue: "",
        company_description: "",
      });
      setPreviewRows([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    } else if (!open && isUploading) {
      console.log("[CSV Upload] Dialog close prevented - upload in progress");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => handleClose(newOpen)}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload CSV Leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file containing leads. Map the columns to the required fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 min-h-0 overflow-y-auto flex flex-col">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select File</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {file ? file.name : "Choose File"}
              </Button>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{parsedData.length} row{parsedData.length === 1 ? "" : "s"} found</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: CSV, Excel (.xlsx, .xls). Required: Company Name, Contact Person, Email, Role.
              Optional: Company Location (City, Country), Industry, Sub-Industry, Annual Revenue, Description.
            </p>
          </div>

          {/* Column Mapping */}
          {headers.length > 0 && (
            <div className="space-y-6 flex-shrink-0">
              {/* Lead Fields Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Lead Fields (Required)</Label>
                </div>
                <div className="grid gap-4">
                  {requiredLeadFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {field.label} <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={columnMapping[field.key as keyof typeof columnMapping]}
                        onValueChange={(value) =>
                          setColumnMapping({
                            ...columnMapping,
                            [field.key]: value,
                          })
                        }
                        disabled={isUploading}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Lead Fields Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Optional Lead Fields</Label>
                </div>
                <div className="grid gap-4">
                  {optionalLeadFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Select
                        value={columnMapping[field.key as keyof typeof columnMapping] || undefined}
                        onValueChange={(value) =>
                          setColumnMapping({
                            ...columnMapping,
                            [field.key]: value || "",
                          })
                        }
                        disabled={isUploading}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue placeholder="Select column (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Fields Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Company Fields (Optional but Recommended)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  These fields will be used to create or update company records. If not mapped, default values will be used.
                </p>
                <div className="grid gap-4">
                  {optionalCompanyFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.required && <span className="text-muted-foreground text-xs ml-1">(will use default if not mapped)</span>}
                      </Label>
                      <Select
                        value={columnMapping[field.key as keyof typeof columnMapping] || "__unmapped__"}
                        onValueChange={(value) =>
                          setColumnMapping({
                            ...columnMapping,
                            [field.key]: value === "__unmapped__" ? "" : value,
                          })
                        }
                        disabled={isUploading}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue placeholder="Select column (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped__">-- Not mapped --</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-sm font-medium">Preview (First 5 rows)</Label>
              <div className="border rounded-md overflow-auto max-h-[300px]">
                <table className="w-full text-sm" style={{ minWidth: 'max-content' }}>
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {headers.map((header) => (
                          <td key={header} className="px-3 py-2 whitespace-nowrap">
                            {row[header]?.toString() || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || parsedData.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

