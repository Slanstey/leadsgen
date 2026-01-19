export type LeadFieldKey =
  | "company"
  | "details"
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
  | "actions";

export type FieldVisibilityConfig = Record<LeadFieldKey, boolean>;

export const defaultFieldVisibility: FieldVisibilityConfig = {
  company: true,
  details: true,
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
  actions: true,
};


