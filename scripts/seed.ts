// This file fills the database with a few starter training groups.
// It is meant to be run when setting up or refreshing the app's sample data.

import { db, pool } from "../db";
import { trainingGroups } from "../db/schema";

// Seed data is defined as an array so the script can iterate over each record
// in a predictable order and keep the actual insert logic generic.
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
    slug: "ages-11-14",
    displayName: "Ages 11–14",
    minimumAge: 11,
    maximumAge: 14,
    capacity: 30,
    registrationOpen: false,
  },
];

// Wrap the seeding workflow in a single async function so we can use structured
// error handling and guarantee the database pool is closed at the end.
async function seedDatabase() {
  try {
    // Insert each group individually. Using an upsert-style operation makes the
    // script idempotent, so re-running it refreshes the same records instead of
    // failing on duplicate keys.
    for (const group of initialTrainingGroups) {
      await db
        .insert(trainingGroups)
        .values(group)
        .onDuplicateKeyUpdate({
          set: {
            slug: group.slug,
          },
        });
    }

    // Read back the table contents after seeding so the script can confirm what
    // is currently stored and present a simple visual audit in the console.
    const savedGroups = await db.select().from(trainingGroups);

    console.log("Training groups seeded successfully:");
    console.table(savedGroups);
  } finally {
    // Close the connection pool no matter what happened above. This is important
    // for one-off scripts because it lets Node exit cleanly after the work ends.
    await pool.end();
  }
}

// Kick off the seed workflow and convert any failure into a non-zero exit code
// so calling scripts or package commands can detect that the seed step failed.
seedDatabase().catch((error: unknown) => {
  console.error("Database seeding failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
