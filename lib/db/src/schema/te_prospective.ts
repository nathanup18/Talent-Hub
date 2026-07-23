import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Anonymized cache of Top Echelon candidates at the 1st Screen pipeline stage
export const teProspectiveCacheTable = pgTable("te_prospective_cache", {
  teId: text("te_id").primaryKey(),
  anonymizedHeadline: text("anonymized_headline").notNull(),
  roleCategory: text("role_category").notNull(),
  seniority: text("seniority").notNull(),
  location: text("location").notNull(),
  topSkills: text("top_skills").array().notNull().default([]),
  summaryBlurb: text("summary_blurb").notNull().default(""),
  educationLevel: text("education_level"),
  yearsExperienceEstimate: text("years_experience_estimate"),
  compExpectation: text("comp_expectation"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  screeningDate: timestamp("screening_date", { withTimezone: true }),
});

// Founder interest expressions on TE prospective candidates
export const teInterestsTable = pgTable(
  "te_interests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    teId: text("te_id").notNull(),
    founderId: integer("founder_id").notNull(),
    note: text("note"),
    expressedAt: timestamp("expressed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("te_interests_te_id_founder_id_idx").on(t.teId, t.founderId)]
);
