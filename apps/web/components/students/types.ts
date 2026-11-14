/**
 * Students directory view-model types shared by the page, header, and table.
 * Keeping them here avoids page <-> component import cycles.
 */

/** Quick filters double as the clickable header tiles. */
export type QuickFilter = "all" | "attention" | "high" | "referrals" | "upcoming" | "never" | "new";

export const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "All students",
  attention: "Needs attention",
  high: "High stress",
  referrals: "Open referrals",
  upcoming: "Upcoming session",
  never: "Never booked",
  new: "New this month",
};

export type StudentSortKey = "alias" | "sessions" | "upcoming" | "referrals" | "screening" | "program";
export type SortDir = "asc" | "desc";
