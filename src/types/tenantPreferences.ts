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
  actions: true,
};


