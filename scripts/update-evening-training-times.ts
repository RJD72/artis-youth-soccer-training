/**
 * One-time change to Tuesday/Thursday training times.
 *
 * Usage:
 *   npx tsx scripts/update-evening-training-times.ts         # validate only
 *   npx tsx scripts/update-evening-training-times.ts --apply # commit changes
 *
 * Before --apply, back up the live database and confirm DB_* targets the
 * intended environment. This updates session records, not registrations.
 * Do not use db:seed as a production schedule migration.
 */
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";

type ScheduleRow = RowDataPacket & {
  id: number;
  slug: string;
  day_of_week: "tuesday" | "thursday";
  session_type: string;
  start_time: string;
  end_time: string;
};

const expected = [
  { slug: "ages-8-10", day: "tuesday", oldStart: "18:00:00", oldEnd: "19:00:00", newStart: "18:30:00", newEnd: "19:30:00" },
  { slug: "ages-8-10", day: "thursday", oldStart: "18:00:00", oldEnd: "19:00:00", newStart: "18:30:00", newEnd: "19:30:00" },
  { slug: "ages-11-13", day: "tuesday", oldStart: "19:00:00", oldEnd: "20:00:00", newStart: "19:30:00", newEnd: "20:30:00" },
  { slug: "ages-11-13", day: "thursday", oldStart: "19:00:00", oldEnd: "20:00:00", newStart: "19:30:00", newEnd: "20:30:00" },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  if (process.argv.some((argument) => argument.startsWith("--") && argument !== "--apply")) {
    throw new Error("Unknown flag. Use no flags for validation or --apply to commit.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Include inactive rows: unexpected duplicates must stop the migration.
    const [rows] = await connection.query<ScheduleRow[]>(
      `SELECT ws.id, tg.slug, ws.day_of_week, ws.session_type,
              ws.start_time, ws.end_time
         FROM weekly_sessions AS ws
         INNER JOIN training_groups AS tg ON tg.id = ws.training_group_id
        WHERE tg.slug IN ('ages-8-10', 'ages-11-13')
          AND ws.day_of_week IN ('tuesday', 'thursday')
        FOR UPDATE`,
    );

    if (rows.length !== expected.length) {
      throw new Error(`Expected exactly 4 Tuesday/Thursday session records, found ${rows.length}. No changes made.`);
    }

    let changes = 0;
    for (const entry of expected) {
      const matching = rows.filter((row) => row.slug === entry.slug && row.day_of_week === entry.day);
      if (matching.length !== 1 || matching[0].session_type !== "training") {
        throw new Error(`Unexpected schedule records for ${entry.slug} / ${entry.day}. No changes made.`);
      }

      const row = matching[0];
      const oldTimes = row.start_time === entry.oldStart && row.end_time === entry.oldEnd;
      const newTimes = row.start_time === entry.newStart && row.end_time === entry.newEnd;
      if (!oldTimes && !newTimes) {
        throw new Error(`Unexpected times for ${entry.slug} / ${entry.day}: ${row.start_time}–${row.end_time}. No changes made.`);
      }

      console.log(`${entry.slug} ${entry.day}: ${row.start_time}–${row.end_time} => ${entry.newStart}–${entry.newEnd}`);
      if (oldTimes && apply) {
        await connection.execute(
          "UPDATE weekly_sessions SET start_time = ?, end_time = ? WHERE id = ?",
          [entry.newStart, entry.newEnd, row.id],
        );
        changes++;
      }
    }

    if (apply) {
      await connection.commit();
      console.log(`Committed ${changes} session updates. Existing registrations untouched.`);
    } else {
      await connection.rollback();
      console.log("Validation complete. Database unchanged. Re-run with --apply to commit.");
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
