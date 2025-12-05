import { useState, useRef, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileText, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Tables } from "@/lib/supabaseUtils";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess?: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface ProcessedLeadCompany {
  name: string;
  location: string;
  industry: string;
  sub_industry: string;
  annual_revenue: string;
  description: string;
}

interface ProcessedLeadRecord {
  company: ProcessedLeadCompany;
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
    is_connected_to_tenant?: boolean;
    created_at: string;
    updated_at: string;
  };
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: CsvUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>("");
  const [csvSeparator, setCsvSeparator] = useState<string>(",");
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
    is_connected_to_tenant: string;
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
    is_connected_to_tenant: "",
    company_location: "",
    company_industry: "",
    company_sub_industry: "",
    company_annual_revenue: "",
    company_description: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stagedLeads, setStagedLeads] = useState<ProcessedLeadRecord[]>([]);

  const requiredLeadFields = [
    { key: "company_name", label: "Company Name" },
    { key: "contact_person", label: "Contact Person" },
    { key: "role", label: "Role" },
  ];

  const optionalLeadFields = [
    { key: "contact_email", label: "Contact Email", required: false },
    { key: "status", label: "Status", required: false },
    { key: "tier", label: "Tier (good/medium/bad)", required: false },
    { key: "tier_reason", label: "Tier Reason", required: false },
    { key: "warm_connections", label: "Warm Connections", required: false },
    { key: "is_connected_to_tenant", label: "Is Connected to Tenant (LinkedIn)", required: false },
  ];

  const optionalCompanyFields = [
    { key: "company_location", label: "Company Location (City, Country)", required: true },
    { key: "company_industry", label: "Company Industry", required: true },
    { key: "company_sub_industry", label: "Company Sub-Industry", required: true },
    { key: "company_annual_revenue", label: "Company Annual Revenue", required: true },
    { key: "company_description", label: "Company Description", required: true },
  ];

  // Function to parse CSV with custom delimiter.
  // Supports:
  // - Quoted fields with inverted commas (")
  // - Delimiters inside quoted fields
  // - Escaped quotes ("") inside quoted fields
  // - Newlines inside quoted fields
  const parseCSV = (text: string, delimiter: string): ParsedRow[] => {
    const rows: string[][] = [];
    let currentField = "";
    let currentRow: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside a quoted field -> add a single quote
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // Toggle quoted state, do not add the quote itself
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Delimiter outside quotes -> end of field
        currentRow.push(currentField.trim());
        currentField = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        // Newline outside quotes -> end of row
        currentRow.push(currentField.trim());
        currentField = "";

        // Only push non-empty rows (ignore stray blank lines)
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];

        // If we hit \r\n, skip the \n
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        // Regular character
        currentField += char;
      }
    }

    // Flush last field / row at EOF
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return [];

    // First row is the header
    const headerCells = rows[0];
    const headers = headerCells.map((h) => h.trim());

    const parsedRows: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const row: ParsedRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      parsedRows.push(row);
    }

    return parsedRows;
  };

  // Helper function retained for potential future use (parses a single CSV line)
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());
    return result;
  };

  // Helper function to auto-detect column mappings
  const autoDetectColumnMapping = (csvHeaders: string[]): typeof columnMapping => {
    const autoMapping = {
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

    return autoMapping;
  };

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

      // Classification successful - only log errors to reduce console noise
      // Individual classification results are not logged to avoid spam
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

      let jsonData: ParsedRow[] = [];

      // Handle CSV files with custom delimiter
      if (fileExtension === ".csv") {
        console.log("[CSV Upload] Reading CSV file as text...");
        const text = await selectedFile.text();
        setFileText(text); // Store file text for separator changes
        console.log("[CSV Upload] CSV text read, parsing with delimiter:", csvSeparator);
        jsonData = parseCSV(text, csvSeparator);
        console.log("[CSV Upload] CSV parsed, rows:", jsonData.length);
      } else {
        // Handle Excel files
        setFileText(""); // Clear file text for non-CSV files
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
        jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet);
        console.log("[CSV Upload] JSON data parsed, rows:", jsonData.length);
      }

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

      // Auto-detect column mapping based on common column names
      console.log("[CSV Upload] Auto-detecting column mappings...");
      const autoMapping = autoDetectColumnMapping(csvHeaders);

      console.log("[CSV Upload] Auto-mapping result:", autoMapping);
      console.log("[CSV Upload] Setting column mapping state...");
      setColumnMapping(autoMapping);

      // Clear any previously staged leads when a new file is selected
      setStagedLeads([]);
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
      setFileText("");
      setStagedLeads([]);
    }
  };

  const buildProcessedLeads = (): ProcessedLeadRecord[] => {
    const processedData = parsedData
      .map((row) => {
        const companyName = row[columnMapping.company_name]?.toString().trim() || "";
        const contactPerson = row[columnMapping.contact_person]?.toString().trim() || "";
        const contactEmail = row[columnMapping.contact_email]?.toString().trim() || "";
        const role = row[columnMapping.role]?.toString().trim() || "";

        // Skip rows with missing required lead fields (email is optional)
        if (!companyName || !contactPerson || !role) {
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

        // Handle is_connected_to_tenant - convert string to boolean
        let isConnectedToTenant = false;
        if (columnMapping.is_connected_to_tenant) {
          const rawValue = row[columnMapping.is_connected_to_tenant]?.toString().trim().toLowerCase() || "";
          isConnectedToTenant = rawValue === "true" || rawValue === "1" || rawValue === "yes" || rawValue === "y";
        }

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
            status,
            tier,
            ...(tierReason && { tier_reason: tierReason }),
            ...(warmConnections && { warm_connections: warmConnections }),
            is_connected_to_tenant: isConnectedToTenant, // Always include, defaults to false
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as ProcessedLeadRecord;
      })
      .filter((item) => item !== null) as ProcessedLeadRecord[];

    return processedData;
  };

  const prepareStagedLeads = () => {
    console.log("[CSV Upload] Preparing staged leads for review...");
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
      console.error("[CSV Upload] No parsed data to stage");
      toast.error("No data to prepare");
      return;
    }

    const processedData = buildProcessedLeads();

    if (processedData.length === 0) {
      toast.error("No valid leads found. Please ensure all required fields are filled.");
      return;
    }

    setStagedLeads(processedData);
    toast.success(`Prepared ${processedData.length} lead${processedData.length === 1 ? "" : "s"} for review. Remove any you don't want, then click Release Leads.`);
  };

  // Automatically prepare staged leads when all required fields are mapped
  useEffect(() => {
    if (parsedData.length === 0) {
      return; // Don't auto-prepare if no data
    }

    // Check if all required fields are mapped
    const allRequiredMapped = requiredLeadFields.every(
      (field) => columnMapping[field.key as keyof typeof columnMapping]
    );

    if (allRequiredMapped) {
      // Small delay to avoid multiple calls during rapid mapping changes
      const timer = setTimeout(() => {
        const processedData = buildProcessedLeads();
        if (processedData.length > 0) {
          setStagedLeads(processedData);
        } else {
          // Clear staged leads if no valid leads found
          setStagedLeads([]);
        }
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Clear staged leads if required fields are not all mapped
      if (stagedLeads.length > 0) {
        setStagedLeads([]);
      }
    }
  }, [columnMapping, parsedData]);

  const handleReleaseLeads = async () => {
    console.log("[CSV Upload] Starting release process for staged leads...");
    console.log("[CSV Upload] Staged leads:", stagedLeads.length);

    if (stagedLeads.length === 0) {
      toast.error("No leads to release. Please prepare leads first.");
      return;
    }

    console.log("[CSV Upload] Setting uploading state to true");
    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0 });

    try {
      // Track unique companies by name
      const companyMap = new Map<string, { id: string; created: boolean }>();
      let companiesCreated = 0;
      let companiesSkipped = 0;
      let companiesFailed = 0;
      let leadsCreated = 0;
      let leadsSkipped = 0;

      // Step 1: Get all unique company names from staged leads (normalized for comparison)
      const uniqueCompanyNames = Array.from(new Set(stagedLeads.map(item => item.company.name.trim())));
      console.log("[CSV Upload] Found", uniqueCompanyNames.length, "unique companies to process");

      // Step 2: Check which companies already exist in the database
      // Fetch all companies for the tenant and do case-insensitive matching
      // This is more reliable than individual queries
      const { data: allTenantCompanies, error: companiesFetchError } = await supabase
        .from(Tables.COMPANIES)
        .select("id, name")
        .eq("tenant_id", tenantId);

      if (companiesFetchError) {
        console.error("[CSV Upload] Error fetching companies:", companiesFetchError);
        throw companiesFetchError;
      }

      const existingCompanyMap = new Map<string, string>();
      const companyNameToDbName = new Map<string, string>(); // Maps normalized name to actual DB name

      // Build a map of all existing companies (case-insensitive)
      const dbCompanyMap = new Map<string, { id: string; name: string }>();
      if (allTenantCompanies) {
        allTenantCompanies.forEach(company => {
          const normalizedDbName = company.name.trim().toLowerCase();
          if (!dbCompanyMap.has(normalizedDbName)) {
            dbCompanyMap.set(normalizedDbName, { id: company.id, name: company.name.trim() });
          }
        });
      }

      // Match staged company names to existing companies
      for (const companyName of uniqueCompanyNames) {
        const normalizedName = companyName.trim().toLowerCase();
        const existingCompany = dbCompanyMap.get(normalizedName);

        if (existingCompany) {
          const trimmedName = companyName.trim();
          existingCompanyMap.set(trimmedName, existingCompany.id);
          companyMap.set(trimmedName, { id: existingCompany.id, created: false });
          companyNameToDbName.set(normalizedName, existingCompany.name); // Store actual DB name with lowercase key
          companiesSkipped++;
        }
      }

      console.log("[CSV Upload] Found", existingCompanyMap.size, "existing companies out of", uniqueCompanyNames.length, "total");

      // Step 3: Identify companies that need to be created
      const companiesToCreate = stagedLeads
        .filter(item => {
          const trimmedName = item.company.name.trim();
          return !existingCompanyMap.has(trimmedName);
        })
        .reduce((acc, item) => {
          const companyName = item.company.name.trim();
          if (!acc.has(companyName)) {
            // Use the first occurrence's company data for each unique company
            acc.set(companyName, {
              tenant_id: tenantId,
              name: companyName,
              location: item.company.location || "",
              industry: item.company.industry || "Unknown",
              sub_industry: item.company.sub_industry || "",
              annual_revenue: item.company.annual_revenue || "",
              description: item.company.description || "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          return acc;
        }, new Map<string, any>());

      console.log("[CSV Upload] Creating", companiesToCreate.size, "new companies");

      // Step 4: Insert new companies in batches
      if (companiesToCreate.size > 0) {
        const companiesArray = Array.from(companiesToCreate.values());
        const companyBatchSize = 50;

        for (let i = 0; i < companiesArray.length; i += companyBatchSize) {
          const companyBatch = companiesArray.slice(i, i + companyBatchSize);

          const { data: newCompanies, error: insertError } = await supabase
            .from(Tables.COMPANIES)
            .insert(companyBatch)
            .select("id, name");

          if (insertError) {
            // If there's a duplicate key error, check which ones succeeded
            if (insertError.code === "23505") {
              // Insert one by one to handle any remaining duplicates
              for (const companyData of companyBatch) {
                try {
                  // Check if it exists now (might have been created by another process or batch)
                  // Try exact match first
                  const normalizedName = companyData.name.trim();
                  let checkCompany = null;

                  const { data: exactCheck } = await supabase
                    .from(Tables.COMPANIES)
                    .select("id, name")
                    .eq("tenant_id", tenantId)
                    .eq("name", normalizedName)
                    .limit(1)
                    .maybeSingle();

                  if (exactCheck) {
                    checkCompany = exactCheck;
                  } else {
                    // Try case-insensitive match
                    const { data: allCompanies } = await supabase
                      .from(Tables.COMPANIES)
                      .select("id, name")
                      .eq("tenant_id", tenantId);

                    if (allCompanies) {
                      const caseInsensitiveMatch = allCompanies.find(
                        c => c.name.trim().toLowerCase() === normalizedName.toLowerCase()
                      );
                      if (caseInsensitiveMatch) {
                        checkCompany = caseInsensitiveMatch;
                      }
                    }
                  }

                  if (checkCompany) {
                    const lowerKey = normalizedName.toLowerCase();
                    companyMap.set(normalizedName, { id: checkCompany.id, created: false });
                    companyNameToDbName.set(lowerKey, checkCompany.name.trim());
                    companiesSkipped++;
                  } else {
                    // Try to insert
                    const { data: insertedCompany, error: singleError } = await supabase
                      .from(Tables.COMPANIES)
                      .insert(companyData)
                      .select("id, name")
                      .single();

                    if (singleError && singleError.code === "23505") {
                      // Still duplicate, check one more time with case-insensitive search
                      const { data: allCompaniesRetry } = await supabase
                        .from(Tables.COMPANIES)
                        .select("id, name")
                        .eq("tenant_id", tenantId);

                      if (allCompaniesRetry) {
                        const finalMatch = allCompaniesRetry.find(
                          c => c.name.trim().toLowerCase() === normalizedName.toLowerCase()
                        );
                        if (finalMatch) {
                          const lowerKey = normalizedName.toLowerCase();
                          companyMap.set(normalizedName, { id: finalMatch.id, created: false });
                          companyNameToDbName.set(lowerKey, finalMatch.name.trim());
                          companiesSkipped++;
                        } else {
                          throw singleError;
                        }
                      } else {
                        throw singleError;
                      }
                    } else if (insertedCompany) {
                      const lowerKey = normalizedName.toLowerCase();
                      companyMap.set(normalizedName, { id: insertedCompany.id, created: true });
                      companyNameToDbName.set(lowerKey, insertedCompany.name.trim());
                      companiesCreated++;
                    } else if (singleError) {
                      throw singleError;
                    }
                  }
                } catch (err: any) {
                  console.error("[CSV Upload] Error creating company:", companyData.name, err);
                  companiesFailed++;
                }
              }
            } else {
              throw insertError;
            }
          } else if (newCompanies) {
            // Successfully inserted
            newCompanies.forEach(company => {
              const normalizedName = company.name.trim();
              const lowerKey = normalizedName.toLowerCase();
              companyMap.set(normalizedName, { id: company.id, created: true });
              companyNameToDbName.set(lowerKey, normalizedName);
              companiesCreated++;
            });
          }
        }
      }

      // Step 5: Filter leads to only include those with valid companies
      const validLeads = stagedLeads.filter((item) => {
        const normalizedCompanyName = item.company.name.trim();
        const companyInfo = companyMap.get(normalizedCompanyName);
        return companyInfo && companyInfo.id;
      });

      console.log("[CSV Upload] Processing", validLeads.length, "leads with valid companies");

      // Step 6: Check which leads already exist (based on tenant_id + company_name + contact_person)
      // Optimized: Fetch all existing leads for this tenant once, then do case-insensitive matching in memory
      // This is much faster than individual queries per lead
      const existingLeadsSet = new Set<string>();

      console.log("[CSV Upload] Fetching existing leads for duplicate check...");
      const { data: allExistingLeads, error: existingLeadsError } = await supabase
        .from(Tables.LEADS)
        .select("company_name, contact_person")
        .eq("tenant_id", tenantId);

      if (existingLeadsError) {
        console.error("[CSV Upload] Error fetching existing leads:", existingLeadsError);
        throw existingLeadsError;
      }

      // Build a normalized set of existing leads for fast lookup
      const existingLeadsNormalized = new Set<string>();
      if (allExistingLeads) {
        for (const lead of allExistingLeads) {
          const normalizedCompany = (lead.company_name || "").trim().toLowerCase();
          const normalizedContact = (lead.contact_person || "").trim().toLowerCase();
          const key = `${tenantId}|||${normalizedCompany}|||${normalizedContact}`;
          existingLeadsNormalized.add(key);
        }
      }

      // Check all staged leads against existing leads in one pass
      for (const leadItem of validLeads) {
        const normalizedCompanyName = leadItem.company.name.trim().toLowerCase();
        const normalizedContactPerson = leadItem.lead.contact_person.trim().toLowerCase();
        const key = `${tenantId}|||${normalizedCompanyName}|||${normalizedContactPerson}`;

        if (existingLeadsNormalized.has(key)) {
          existingLeadsSet.add(key);
        }
      }

      console.log("[CSV Upload] Found", existingLeadsSet.size, "existing leads out of", validLeads.length, "total");

      // Step 7: Filter out existing leads and prepare new leads for insertion
      // Use normalized company names from the database
      // Duplicate check: tenant_id + company_name + contact_person
      // This allows the same contact person to exist at different companies
      const leadsToInsert = validLeads
        .filter(item => {
          const normalizedCompanyName = item.company.name.trim();
          const normalizedContactPerson = item.lead.contact_person.trim();
          // Include tenant_id in the key to match the duplicate check
          const key = `${tenantId}|||${normalizedCompanyName.toLowerCase()}|||${normalizedContactPerson.toLowerCase()}`;
          return !existingLeadsSet.has(key);
        })
        .map(item => {
          // Use the actual company name from the database (if it exists) or normalized name
          const normalizedCompanyName = item.company.name.trim();
          const lowerKey = normalizedCompanyName.toLowerCase();
          // Get the actual DB name if company exists, otherwise use normalized name
          const dbCompanyName = companyNameToDbName.get(lowerKey) || normalizedCompanyName;

          return {
            ...item.lead,
            company_name: dbCompanyName, // Use the actual name from database
          };
        });

      console.log("[CSV Upload] Inserting", leadsToInsert.length, "new leads");

      // Step 8: Insert new leads in batches
      // Increased batch size for better performance with large uploads
      if (leadsToInsert.length > 0) {
        const batchSize = 200;
        setUploadProgress({ current: 0, total: leadsToInsert.length });

        for (let i = 0; i < leadsToInsert.length; i += batchSize) {
          const batch = leadsToInsert.slice(i, i + batchSize);
          setUploadProgress({ current: Math.min(i + batchSize, leadsToInsert.length), total: leadsToInsert.length });

          try {
            const { data: insertedLeads, error: leadsError } = await supabase
              .from(Tables.LEADS)
              .insert(batch as any)
              .select();

            if (leadsError) {
              // If it's a unique constraint violation, try inserting one by one
              // This should be rare since we already checked for duplicates
              if (leadsError.code === "23505") {
                console.log("[CSV Upload] Unique constraint violation, inserting leads individually...");
                for (const lead of batch) {
                  try {
                    // Use the existing leads set we already fetched for fast lookup
                    const normalizedCompanyName = (lead.company_name || "").trim().toLowerCase();
                    const normalizedContactPerson = (lead.contact_person || "").trim().toLowerCase();
                    const key = `${tenantId}|||${normalizedCompanyName}|||${normalizedContactPerson}`;

                    // Check against our existing leads set first (fast)
                    if (existingLeadsSet.has(key)) {
                      leadsSkipped++;
                      continue;
                    }

                    // If not in our set, try inserting (might be a race condition)
                    const { data: newLead, error: insertError } = await supabase
                      .from(Tables.LEADS)
                      .insert(lead as any)
                      .select()
                      .single();

                    if (newLead) {
                      leadsCreated++;
                      // Add to existing set to avoid future duplicates in this batch
                      existingLeadsSet.add(key);
                      // Classify lead asynchronously
                      classifyLead(newLead.id, tenantId).catch(err => {
                        console.error("[CSV Upload] Error classifying lead:", err);
                      });
                    } else if (insertError && insertError.code === "23505") {
                      // Still a duplicate, skip it
                      leadsSkipped++;
                      existingLeadsSet.add(key);
                    }
                  } catch (err: any) {
                    console.error("[CSV Upload] Error inserting individual lead:", err);
                    leadsSkipped++;
                  }
                }
              } else {
                throw leadsError;
              }
            } else if (insertedLeads) {
              leadsCreated += insertedLeads.length;
              // Classify all inserted leads asynchronously
              insertedLeads.forEach((lead: any) => {
                classifyLead(lead.id, tenantId).catch(err => {
                  console.error("[CSV Upload] Error classifying lead:", err);
                });
              });
            }
          } catch (error: any) {
            console.error("[CSV Upload] Error inserting leads batch:", error);
            // Continue with next batch
          }
        }
      }

      leadsSkipped += existingLeadsSet.size;

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
      setFileText("");
      setCsvSeparator(",");
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
        is_connected_to_tenant: "",
        company_location: "",
        company_industry: "",
        company_sub_industry: "",
        company_annual_revenue: "",
        company_description: "",
      });
      setStagedLeads([]);
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

  const handlePrimaryAction = async () => {
    if (stagedLeads.length === 0) {
      prepareStagedLeads();
    } else {
      await handleReleaseLeads();
    }
  };

  const handleRemoveStagedLead = (index: number) => {
    setStagedLeads((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = (open: boolean) => {
    console.log("[CSV Upload] Dialog close requested, open:", open, "isUploading:", isUploading);
    if (!open && !isUploading) {
      console.log("[CSV Upload] Resetting state and closing dialog");
      setFile(null);
      setFileText("");
      setCsvSeparator(",");
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
        is_connected_to_tenant: "",
        company_location: "",
        company_industry: "",
        company_sub_industry: "",
        company_annual_revenue: "",
        company_description: "",
      });
      setStagedLeads([]);
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
              Supported formats: CSV, Excel (.xlsx, .xls). Required: Company Name, Contact Person, Role.
              Optional: Email, Company Location (City, Country), Industry, Sub-Industry, Annual Revenue, Description.
            </p>
          </div>

          {/* CSV Separator Selection - Only show for CSV files */}
          {file && file.name.toLowerCase().endsWith(".csv") && (
            <div className="space-y-2">
              <Label htmlFor="csv-separator">CSV Separator</Label>
              <Select
                value={csvSeparator}
                onValueChange={(value) => {
                  setCsvSeparator(value);
                  // Re-parse the file with new separator using stored file text
                  if (fileText) {
                    try {
                      const newData = parseCSV(fileText, value);
                      if (newData.length > 0) {
                        const firstRow = newData[0];
                        const csvHeaders = Object.keys(firstRow);

                        // Update headers and parsed data first
                        setHeaders(csvHeaders);
                        setParsedData(newData);

                        // Reset column mapping and auto-detect again
                        const autoMapping = autoDetectColumnMapping(csvHeaders);
                        setColumnMapping(autoMapping);

                        // Clear staged leads - they will be rebuilt by useEffect when column mapping is set
                        setStagedLeads([]);
                      } else {
                        toast.error("No data found in file with this separator");
                        setHeaders([]);
                        setParsedData([]);
                        setStagedLeads([]);
                      }
                    } catch (error: any) {
                      console.error("[CSV Upload] Error re-parsing file:", error);
                      toast.error(`Failed to parse file: ${error?.message || "Unknown error"}`);
                    }
                  }
                }}
                disabled={isUploading}
              >
                <SelectTrigger id="csv-separator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=";">Semicolon (;)</SelectItem>
                  <SelectItem value="\t">Tab</SelectItem>
                  <SelectItem value="|">Pipe (|)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the character that separates columns in your CSV file.
              </p>
            </div>
          )}

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
                        value={columnMapping[field.key as keyof typeof columnMapping] || ""}
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
                        value={columnMapping[field.key as keyof typeof columnMapping] || ""}
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

          {/* Leads Preview & Cleanup */}
          {stagedLeads.length > 0 && (
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-sm font-medium">
                Leads to be created ({stagedLeads.length})
              </Label>
              <div className="border rounded-md overflow-auto" style={{ maxHeight: '600px' }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>LinkedIn Connected</TableHead>
                      <TableHead className="w-[60px] text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedLeads.map((item, index) => (
                      <TableRow key={`${item.lead.company_name}-${item.lead.contact_person}-${index}`}>
                        <TableCell>{item.lead.company_name}</TableCell>
                        <TableCell>{item.lead.contact_person}</TableCell>
                        <TableCell>{item.lead.contact_email}</TableCell>
                        <TableCell>{item.lead.role}</TableCell>
                        <TableCell className="capitalize text-xs">
                          {item.lead.status.replace("_", " ")}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {item.lead.tier}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.lead.is_connected_to_tenant ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStagedLead(index)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Remove any leads you don&apos;t want before releasing them to the database.
              </p>
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
            onClick={handlePrimaryAction}
            disabled={isUploading || (parsedData.length === 0 && stagedLeads.length === 0)}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadProgress.total > 0
                  ? `Uploading leads... ${uploadProgress.current}/${uploadProgress.total}`
                  : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Release Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

