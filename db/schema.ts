// This file describes the database tables and columns used by the app.
// It tells Drizzle how the training group data is stored in MySQL.

import {
  boolean,
  char,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
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

export const guardians = mysqlTable("guardians", {
  id: int("id", {
    unsigned: true,
  })
    .autoincrement()
    .primaryKey(),

  fullName: varchar("full_name", {
    length: 100,
  }).notNull(),

  email: varchar("email", {
    length: 254,
  })
    .notNull()
    .unique(),

  phone: varchar("phone", {
    length: 30,
  }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const players = mysqlTable(
  "players",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    guardianId: int("guardian_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => guardians.id, {
        onDelete: "restrict",
      }),

    fullName: varchar("full_name", {
      length: 100,
    }).notNull(),

    dateOfBirth: date("date_of_birth", {
      mode: "string",
    }).notNull(),

    emergencyContactName: varchar("emergency_contact_name", {
      length: 100,
    }).notNull(),

    emergencyContactRelationship: varchar("emergency_contact_relationship", {
      length: 50,
    }).notNull(),

    emergencyContactPhone: varchar("emergency_contact_phone", {
      length: 30,
    }).notNull(),

    medicalInformationEncrypted: text("medical_information_encrypted"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("players_guardian_id_index").on(table.guardianId)],
);

export const registrations = mysqlTable(
  "registrations",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    playerId: int("player_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => players.id, {
        onDelete: "restrict",
      }),

    trainingGroupId: int("training_group_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => trainingGroups.id, {
        onDelete: "restrict",
      }),

    programPackageId: int("program_package_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => programPackages.id, {
        onDelete: "restrict",
      }),

    status: mysqlEnum("status", [
      "pending_payment",
      "scheduled",
      "active",
      "waitlisted",
      "expired",
      "cancelled",
    ])
      .notNull()
      .default("pending_payment"),

    packagePriceCents: int("package_price_cents", {
      unsigned: true,
    }).notNull(),

    currency: char("currency", {
      length: 3,
    })
      .notNull()
      .default("CAD"),

    startsOn: date("starts_on", {
      mode: "string",
    }),

    endsOn: date("ends_on", {
      mode: "string",
    }),

    reservationExpiresAt: timestamp("reservation_expires_at"),

    waitlistedAt: timestamp("waitlisted_at"),

    activatedAt: timestamp("activated_at"),

    cancelledAt: timestamp("cancelled_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("registrations_player_id_index").on(table.playerId),

    index("registrations_group_status_end_index").on(
      table.trainingGroupId,
      table.status,
      table.endsOn,
    ),

    index("registrations_waitlist_order_index").on(
      table.trainingGroupId,
      table.status,
      table.waitlistedAt,
    ),
  ],
);
