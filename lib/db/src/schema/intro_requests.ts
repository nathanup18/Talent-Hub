import {
  pgTable,
  serial,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { candidatesTable } from "./candidates";

export const introRequestStatusEnum = pgEnum("intro_request_status", [
  "requested",
  "offered",
  "intro_made",
  "placed",
  "closed",
]);

export const introRequestsTable = pgTable("intro_requests", {
  id: serial("id").primaryKey(),
  founderId: integer("founder_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  status: introRequestStatusEnum("status").notNull().default("requested"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type IntroRequest = typeof introRequestsTable.$inferSelect;
