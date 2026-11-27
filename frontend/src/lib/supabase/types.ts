export type UserRole = "super_admin" | "organization";
export type OrganizationStatus = "active" | "suspended";

export interface Organization {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status?: OrganizationStatus;
  user_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status?: OrganizationStatus;
  name?: string;
  org_id?: string;
}

// Backwards compatibility alias
export type SuperAdminUser = AuthUser;
