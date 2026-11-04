export type ReferralStatus = "initiated" | "accepted" | "in_progress" | "completed" | "declined";

export interface ReferralPartner {
  id: string;
  name: string;
  type: string;
  contactName: string;
  status: "active" | "inactive";
}

export interface MatterReferral {
  id: string;
  partner: string;
  partnerId: string;
  reason: string;
  status: ReferralStatus;
  date: string;
  contactPerson: string;
  notes: string;
  createdBy: string;
  clientAcknowledged?: boolean;
}
