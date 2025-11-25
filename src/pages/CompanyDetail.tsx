import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, MapPin, Briefcase, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

const CompanyDetail = () => {
  const { companyName } = useParams<{ companyName: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  
  const decodedName = decodeURIComponent(companyName || "");

  useEffect(() => {
    if (!decodedName || !profile?.tenant_id) {
      setLoading(false);
      return;
    }

    const fetchCompanyData = async () => {
      try {
        setLoading(true);
        
        // Fetch company
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("*")
          .eq("name", decodedName)
          .single();

        if (companyError) {
          console.error("Error fetching company:", companyError);
          console.error("Searched for company name:", decodedName);
          // Try to find similar companies for debugging
          const { data: similar } = await supabase
            .from("companies")
            .select("name")
            .limit(5);
          console.log("Available companies:", similar);
          setLoading(false);
          return;
        }

        if (!companyData) {
          setLoading(false);
          return;
        }

        setCompany(companyData);
      } catch (error) {
        console.error("Error fetching company data:", error);
        toast.error("Failed to load company information");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [decodedName, profile?.tenant_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Company Not Found</h1>
          <p className="text-muted-foreground mb-4">The company you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{company.name}</h1>
              <p className="text-muted-foreground mt-1">{company.description}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.description && (
                  <div className="pb-4 border-b border-border/50">
                    <p className="text-sm leading-relaxed text-foreground">{company.description}</p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="font-medium">{company.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Industry</p>
                      <p className="font-medium">{company.industry}</p>
                    </div>
                  </div>
                  {company.location && (
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p className="font-medium">{company.location}</p>
                      </div>
                    </div>
                  )}
                  {company.annual_revenue && (
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Annual Revenue</p>
                        <p className="font-medium">{company.annual_revenue}</p>
                      </div>
                    </div>
                  )}
                  {company.industry && (
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Industry</p>
                        <p className="font-medium">{company.industry}</p>
                      </div>
                    </div>
                  )}
                  {company.sub_industry && (
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Sub-Industry</p>
                        <p className="font-medium">{company.sub_industry}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {(newsLoading || news.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Latest News</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {newsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Fetching latest news...</span>
                    </div>
                  ) : (
                    news.map((item) => (
                      <div key={item.id} className="border-l-4 border-primary pl-4 py-2">
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{item.summary}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.source}</span>
                          <span>•</span>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanyDetail;
