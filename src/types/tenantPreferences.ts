export type LeadFieldKey =
  | "company"
  | "industry"
  | "location"
  | "description"
  | "contactPerson"
  | "contactEmail"
  | "role"
  | "tier"
  | "status"
  | "warmConnections"
  | "isConnectedToTenant"
  | "followsOnLinkedin"
  | "marketCapitalisation"
  | "companySizeInterval"
  | "commodityFields"
  | "actionEmail"
  | "actionFeedback"
  | "actionComments";

export type FieldVisibilityConfig = Record<LeadFieldKey, boolean>;

export const defaultFieldVisibility: FieldVisibilityConfig = {
  company: true,
  industry: true,
  location: true,
  description: true,
  contactPerson: true,
  contactEmail: true,
  role: true,
  tier: true,
  status: true,
  warmConnections: true,
  isConnectedToTenant: true,
  followsOnLinkedin: true,
  marketCapitalisation: true,
  companySizeInterval: true,
  commodityFields: true,
  actionEmail: true,
  actionFeedback: true,
  actionComments: true,
};


