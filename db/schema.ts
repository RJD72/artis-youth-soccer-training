import {
  boolean,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const trainingGroups = mysqlTable("training_groups", {
  id: int("id", {
    unsigned: true,
  })
    .autoincrement()
    .primaryKey(),

  slug: varchar("slug", {
    length: 50,
  })
    .notNull()
    .unique(),

  displayName: varchar("display_name", {
    length: 100,
  }).notNull(),

  minimumAge: int("minimum_age", {
    unsigned: true,
  }).notNull(),

  maximumAge: int("maximum_age", {
    unsigned: true,
  }).notNull(),

  capacity: int("capacity", {
    unsigned: true,
  })
    .notNull()
    .default(30),

  registrationOpen: boolean("registration_open").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
