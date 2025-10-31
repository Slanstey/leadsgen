export type LeadStatus = 
  | "not_contacted" 
  | "contacted" 
  | "qualified" 
  | "in_progress" 
  | "closed_won" 
  | "closed_lost";

export interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  role: string;
  status: LeadStatus;
  comments: Comment[];
  createdAt: Date;
  updatedAt: Date;
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
