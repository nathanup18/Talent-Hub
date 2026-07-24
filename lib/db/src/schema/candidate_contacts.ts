import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { candidatesTable } from "./candidates";

// Private, admin-only "connected record": the real identity + contact details
// behind an anonymized candidate, used to auto-make an introduction when a
// founder requests one. This is NEVER included in any founder-facing response.
export const candidateContactsTable = pgTable("candidate_contacts", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id")
    .notNull()
    .unique()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  // Optional link back to the Top Echelon person this candidate came from.
  teId: text("te_id"),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  // Where the contact came from: "manual" or "top_echelon".
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CandidateContact = typeof candidateContactsTable.$inferSelect;
