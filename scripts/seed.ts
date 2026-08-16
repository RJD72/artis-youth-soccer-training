// This file fills the database with a few starter training groups.
// It is meant to be run when setting up or refreshing the app's sample data.

// This script inserts the application's required starter data.
//
// It creates:
// 1. The two age-based training groups.
// 2. The repeating weekly schedule for each group.
//
// The duplicate-key handling makes the script safe to run more than once.

import { eq } from "drizzle-orm";

import { db, pool } from "../db";
import { trainingGroups, weeklySchedules } from "../db/schema";

const initialTrainingGroups: (typeof trainingGroups.$inferInsert)[] = [
  {
    slug: "ages-8-10",
    displayName: "Ages 8–10",
    minimumAge: 8,
    maximumAge: 10,
    capacity: 30,
    registrationOpen: false,
  },
  {
    slug: "ages-11-13",
    displayName: "Ages 11–13",
    minimumAge: 11,
    maximumAge: 13,
    capacity: 30,
    registrationOpen: false,
  },
];

async function seedDatabase() {
  try {
    // Insert the two groups first because weekly_sessions.training_group_id
    // must point to an existing training_groups.id.
    for (const group of initialTrainingGroups) {
      await db
        .insert(trainingGroups)
        .values(group)
        .onDuplicateKeyUpdate({
          set: {
            displayName: group.displayName,
            minimumAge: group.minimumAge,
            maximumAge: group.maximumAge,
            capacity: group.capacity,
          },
        });
    }

    // Read the groups back from MySQL so we can use their real generated IDs.
    const savedGroups = await db
      .select({
        id: trainingGroups.id,
        slug: trainingGroups.slug,
        displayName: trainingGroups.displayName,
      })
      .from(trainingGroups);

    // Convert the returned rows into a lookup such as:
    //
    // "ages-8-10"  => 1
    // "ages-11-13" => 2
    //
    // The IDs may not always be 1 and 2, so we must not hard-code them.
    const groupIdBySlug = new Map(
      savedGroups.map((group) => [group.slug, group.id]),
    );

    function requireTrainingGroupId(slug: string): number {
      const groupId = groupIdBySlug.get(slug);

      if (groupId === undefined) {
        throw new Error(
          `Cannot create the weekly schedule because group "${slug}" was not found.`,
        );
      }

      return groupId;
    }

    const youngerGroupId = requireTrainingGroupId("ages-8-10");

    const olderGroupId = requireTrainingGroupId("ages-11-13");

    const initialWeeklySchedules: (typeof weeklySchedules.$inferInsert)[] = [
      {
        trainingGroupId: youngerGroupId,
        dayOfWeek: "tuesday",
        sessionType: "training",
        startTime: "18:00:00",
        endTime: "19:00:00",
        isActive: true,
      },
      {
        trainingGroupId: youngerGroupId,
        dayOfWeek: "thursday",
        sessionType: "training",
        startTime: "18:00:00",
        endTime: "19:00:00",
        isActive: true,
      },
      {
        trainingGroupId: youngerGroupId,
        dayOfWeek: "saturday",
        sessionType: "game_training",
        startTime: "10:00:00",
        endTime: "11:00:00",
        isActive: true,
      },
      {
        trainingGroupId: olderGroupId,
        dayOfWeek: "tuesday",
        sessionType: "training",
        startTime: "19:00:00",
        endTime: "20:00:00",
        isActive: true,
      },
      {
        trainingGroupId: olderGroupId,
        dayOfWeek: "thursday",
        sessionType: "training",
        startTime: "19:00:00",
        endTime: "20:00:00",
        isActive: true,
      },
      {
        trainingGroupId: olderGroupId,
        dayOfWeek: "saturday",
        sessionType: "game_training",
        startTime: "11:00:00",
        endTime: "12:00:00",
        isActive: true,
      },
    ];

    for (const session of initialWeeklySchedules) {
      await db
        .insert(weeklySchedules)
        .values(session)
        .onDuplicateKeyUpdate({
          set: {
            sessionType: session.sessionType,
            endTime: session.endTime,
            isActive: true,
          },
        });
    }

    // Join the two tables so the console shows the readable group name
    // instead of only displaying its numeric foreign-key ID.
    const savedSchedules = await db
      .select({
        group: trainingGroups.displayName,
        day: weeklySchedules.dayOfWeek,
        type: weeklySchedules.sessionType,
        startTime: weeklySchedules.startTime,
        endTime: weeklySchedules.endTime,
        active: weeklySchedules.isActive,
      })
      .from(weeklySchedules)
      .innerJoin(
        trainingGroups,
        eq(weeklySchedules.trainingGroupId, trainingGroups.id),
      )
      .orderBy(
        trainingGroups.minimumAge,
        weeklySchedules.dayOfWeek,
        weeklySchedules.startTime,
      );

    console.log("Database seeded successfully:");
    console.table(savedSchedules);
  } finally {
    await pool.end();
  }
}

seedDatabase().catch((error: unknown) => {
  console.error("Database seeding failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
