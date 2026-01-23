export type LeadStatus =
  | "not_contacted"
  | "contacted"
  | "discussing_scope"
  | "proposal_delivered"
  | "ignored";

export type LeadTier = "1st" | "2nd" | "3rd";

export interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  role: string;
  status: LeadStatus;
  tier: LeadTier;
  tierReason?: string;
  warmConnections?: string;
  isConnectedToTenant?: boolean;
  followsOnLinkedin?: boolean;
  marketCapitalisation?: number; // Market cap in millions
  companySizeInterval?: string;
  commodityFields?: string;
  userFeedbackStatus?: "good" | "bad"; // Most recent user feedback status
  comments: Comment[];
  createdAt: Date;
  updatedAt: Date;
  company?: {
    industry?: string;
    location?: string;
    annualRevenue?: string;
    description?: string;
  };
}

export interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  author: string;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  annualRevenue: string;
  industry: string;
  subIndustry: string;
  executives: Executive[];
  description: string;
}

export interface Executive {
  name: string;
  title: string;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  source: string;
  summary: string;
}
