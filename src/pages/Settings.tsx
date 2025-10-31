import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    targetIndustry: "",
    companySize: "",
    geographicRegion: "",
    targetRoles: "",
    revenueRange: "",
    keywords: "",
    notes: "",
  });

  const handleSave = () => {
    // In a real app, this would save to a database
    toast.success("Lead generation preferences saved successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your lead generation preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lead Generation Preferences</CardTitle>
            <CardDescription>
              Define your ideal lead criteria to help target the right prospects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetIndustry">Target Industry</Label>
                <Input
                  id="targetIndustry"
                  placeholder="e.g., Mining, Energy, Manufacturing"
                  value={formData.targetIndustry}
                  onChange={(e) =>
                    setFormData({ ...formData, targetIndustry: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companySize: value })
                  }
                >
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-50">1-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-1000">201-1000 employees</SelectItem>
                    <SelectItem value="1001-5000">1001-5000 employees</SelectItem>
                    <SelectItem value="5000+">5000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geographicRegion">Geographic Region</Label>
                <Input
                  id="geographicRegion"
                  placeholder="e.g., North America, APAC, Europe"
                  value={formData.geographicRegion}
                  onChange={(e) =>
                    setFormData({ ...formData, geographicRegion: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenueRange">Annual Revenue Range</Label>
                <Select
                  value={formData.revenueRange}
                  onValueChange={(value) =>
                    setFormData({ ...formData, revenueRange: value })
                  }
                >
                  <SelectTrigger id="revenueRange">
                    <SelectValue placeholder="Select revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-10m">$0-10M</SelectItem>
                    <SelectItem value="10m-50m">$10M-50M</SelectItem>
                    <SelectItem value="50m-100m">$50M-100M</SelectItem>
                    <SelectItem value="100m-500m">$100M-500M</SelectItem>
                    <SelectItem value="500m-1b">$500M-1B</SelectItem>
                    <SelectItem value="1b+">$1B+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRoles">Target Roles/Titles</Label>
              <Input
                id="targetRoles"
                placeholder="e.g., CEO, COO, VP Operations, Chief Mining Officer"
                value={formData.targetRoles}
                onChange={(e) =>
                  setFormData({ ...formData, targetRoles: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of target roles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                placeholder="e.g., sustainability, expansion, digital transformation"
                value={formData.keywords}
                onChange={(e) =>
                  setFormData({ ...formData, keywords: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Keywords to help identify relevant leads
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional criteria or preferences..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
