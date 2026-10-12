-- Run once against the application's existing database when deploying the 7–10 update.
-- Keep the same group ID and slug; existing registrations, schedules, and waitlists
-- remain attached. Do not run the full seed script for this production change.
UPDATE training_groups
SET minimum_age = 7, display_name = 'Ages 7–10'
WHERE slug = 'ages-8-10'
  AND minimum_age IN (7, 8)
  AND maximum_age = 10;

-- Verify: exactly one existing group should show minimum_age 7 and maximum_age 10.
SELECT id, slug, display_name, minimum_age, maximum_age, capacity, registration_open
FROM training_groups
WHERE slug = 'ages-8-10';
