// This file describes the database tables and columns used by the app.
// It tells Drizzle how the training group data is stored in MySQL.

import {
  boolean,
  char,
  int,
  mysqlEnum,
  mysqlTable,
  time,
  timestamp,
  uniqueIndex,
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

export const weeklySchedules = mysqlTable(
  "weekly_sessions",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    trainingGroupId: int("training_group_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => trainingGroups.id, {
        onDelete: "restrict",
      }),

    dayOfWeek: mysqlEnum("day_of_week", [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]).notNull(),

    sessionType: mysqlEnum("session_type", [
      "training",
      "game_training",
    ]).notNull(),

    startTime: time("start_time").notNull(),

    endTime: time("end_time").notNull(),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("weekly_sessions_group_day_start_unique").on(
      table.trainingGroupId,
      table.dayOfWeek,
      table.startTime,
    ),
  ],
);

export const programPackages = mysqlTable("program_packages", {
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

  durationMonths: int("duration_months", {
    unsigned: true,
  }).notNull(),

  priceCents: int("price_cents", {
    unsigned: true,
  }).notNull(),

  currency: char("currency", {
    length: 3,
  })
    .notNull()
    .default("CAD"),

  taxBehavior: mysqlEnum("tax_behavior", ["exclusive", "inclusive"])
    .notNull()
    .default("exclusive"),

  stripePriceId: varchar("stripe_price_id", {
    length: 255,
  }).unique(),

  isActive: boolean("is_active").notNull().default(true),

  displayOrder: int("display_order", {
    unsigned: true,
  }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
