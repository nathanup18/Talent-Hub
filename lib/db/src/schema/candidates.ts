import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleCategoryEnum = pgEnum("role_category", [
  "Engineering",
  "Sales",
  "Operations",
  "Product",
  "Finance",
  "Marketing",
  "Executive",
]);

export const seniorityEnum = pgEnum("seniority", [
  "IC",
  "Manager",
  "Director",
  "VP",
  "C-level",
]);

export const candidateStatusEnum = pgEnum("candidate_status", [
  "opted_in",
  "paused",
  "placed",
  "withdrawn",
]);

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  internalId: text("internal_id").notNull().unique(),
  realName: text("real_name").notNull(),
  anonymizedHeadline: text("anonymized_headline").notNull(),
  roleCategory: roleCategoryEnum("role_category").notNull(),
  seniority: seniorityEnum("seniority").notNull(),
  yearsExperience: integer("years_experience").notNull(),
  location: text("location").notNull(),
  openToRelocation: boolean("open_to_relocation").notNull().default(false),
  compRangeMin: integer("comp_range_min").notNull(),
  compRangeMax: integer("comp_range_max").notNull(),
  topSkills: text("top_skills").array().notNull().default([]),
  summaryBlurb: text("summary_blurb").notNull(),
  notableCredentials: text("notable_credentials").notNull(),
  status: candidateStatusEnum("status").notNull().default("opted_in"),
  // Which pool this candidate belongs to: the vetted "talent_pool" (1st Screen,
  // request intro) or "prospective" (earlier funnel, express interest only).
  pool: text("pool").notNull().default("talent_pool"),
  // Optional link to the Top Echelon person this candidate came from. The real
  // identity/contact is NOT stored here — it is fetched live from TE when an
  // admin views it or a founder requests an intro.
  teId: text("te_id"),
  // Anonymized profile derived from the candidate's resume (no name, contact,
  // employer names, or exact dates). Shown to founders behind the listing.
  blindResume: text("blind_resume"),
  dateAdded: date("date_added", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
