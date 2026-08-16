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

export const payments = mysqlTable(
  "payments",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    registrationId: int("registration_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => registrations.id, {
        onDelete: "restrict",
      }),

    status: mysqlEnum("status", [
      "pending",
      "succeeded",
      "failed",
      "cancelled",
      "partially_refunded",
      "refunded",
    ])
      .notNull()
      .default("pending"),

    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 255,
    }).unique(),

    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }).unique(),

    subtotalCents: int("subtotal_cents", {
      unsigned: true,
    }).notNull(),

    taxCents: int("tax_cents", {
      unsigned: true,
    })
      .notNull()
      .default(0),

    totalCents: int("total_cents", {
      unsigned: true,
    }).notNull(),

    refundedCents: int("refunded_cents", {
      unsigned: true,
    })
      .notNull()
      .default(0),

    currency: char("currency", {
      length: 3,
    })
      .notNull()
      .default("CAD"),

    paidAt: timestamp("paid_at"),

    refundedAt: timestamp("refunded_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("payments_registration_id_index").on(table.registrationId),

    index("payments_status_index").on(table.status),
  ],
);

export const legalDocuments = mysqlTable(
  "legal_documents",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    documentType: mysqlEnum("document_type", [
      "participation_waiver",
      "privacy_policy",
      "cancellation_refund_policy",
    ]).notNull(),

    version: varchar("version", {
      length: 50,
    }).notNull(),

    title: varchar("title", {
      length: 200,
    }).notNull(),

    content: text("content").notNull(),

    contentHash: char("content_hash", {
      length: 64,
    }).notNull(),

    isActive: boolean("is_active").notNull().default(false),

    publishedAt: timestamp("published_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("legal_documents_type_version_unique").on(
      table.documentType,
      table.version,
    ),

    index("legal_documents_active_index").on(
      table.documentType,
      table.isActive,
    ),
  ],
);

export const legalAcceptances = mysqlTable(
  "legal_acceptances",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    registrationId: int("registration_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => registrations.id, {
        onDelete: "restrict",
      }),

    guardianId: int("guardian_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => guardians.id, {
        onDelete: "restrict",
      }),

    legalDocumentId: int("legal_document_id", {
      unsigned: true,
    })
      .notNull()
      .references(() => legalDocuments.id, {
        onDelete: "restrict",
      }),

    acceptedByName: varchar("accepted_by_name", {
      length: 100,
    }).notNull(),

    acceptedAt: timestamp("accepted_at").notNull().defaultNow(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_acceptances_registration_document_unique").on(
      table.registrationId,
      table.legalDocumentId,
    ),

    index("legal_acceptances_guardian_id_index").on(table.guardianId),

    index("legal_acceptances_document_id_index").on(table.legalDocumentId),
  ],
);

export const stripeWebhookEvents = mysqlTable(
  "stripe_webhook_events",
  {
    id: int("id", {
      unsigned: true,
    })
      .autoincrement()
      .primaryKey(),

    stripeEventId: varchar("stripe_event_id", {
      length: 255,
    })
      .notNull()
      .unique(),

    eventType: varchar("event_type", {
      length: 100,
    }).notNull(),

    stripeObjectId: varchar("stripe_object_id", {
      length: 255,
    }),

    processingStatus: mysqlEnum("processing_status", [
      "received",
      "processing",
      "processed",
      "failed",
    ])
      .notNull()
      .default("received"),

    attemptCount: int("attempt_count", {
      unsigned: true,
    })
      .notNull()
      .default(0),

    lastError: text("last_error"),

    livemode: boolean("livemode").notNull().default(false),

    receivedAt: timestamp("received_at").notNull().defaultNow(),

    processedAt: timestamp("processed_at"),

    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("stripe_webhook_events_status_index").on(table.processingStatus),

    index("stripe_webhook_events_object_index").on(
      table.eventType,
      table.stripeObjectId,
    ),
  ],
);
