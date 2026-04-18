-- Backfill topic tags onto datasets that predate the topics migration.
--
-- The previous migration (20260418000000_add_dataset_topics) seeded topics
-- and linked them to providers, but existing DatasetEntry rows were created
-- before topics existed and so carry no tags. That breaks the area/topic
-- filters in the public registry: selecting "Life Sciences" returns zero
-- rows even when an OpenNeuro dataset is clearly present.
--
-- Rule: a dataset without any ACTIVE topics inherits every ACTIVE topic
-- from its parent provider. Datasets that already have at least one topic
-- are left alone (agents may have tagged them intentionally). Orphan
-- datasets with no provider fall back to the "interdisciplinary" topic so
-- they still surface under the "Other" area.

-- Step 1: inherit provider topics for datasets that currently have none.
INSERT INTO "_DatasetEntryToDatasetTopic" ("A", "B")
SELECT de.id, pt."B"
FROM "DatasetEntry" de
JOIN "_DatasetProviderToDatasetTopic" pt ON pt."A" = de."providerId"
JOIN "DatasetTopic" t ON t.id = pt."B" AND t.status = 'ACTIVE'
WHERE de."providerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_DatasetEntryToDatasetTopic" existing
    JOIN "DatasetTopic" existing_topic ON existing_topic.id = existing."B"
    WHERE existing."A" = de.id AND existing_topic.status = 'ACTIVE'
  )
ON CONFLICT DO NOTHING;

-- Step 2: catch the remaining orphans (no provider, or provider had no
-- topics) by routing them to interdisciplinary in the OTHER area. Guarded
-- by EXISTS so this is a no-op if the topic was renamed away.
INSERT INTO "_DatasetEntryToDatasetTopic" ("A", "B")
SELECT de.id, 'topic_interdisciplinary'
FROM "DatasetEntry" de
WHERE EXISTS (
    SELECT 1 FROM "DatasetTopic" WHERE id = 'topic_interdisciplinary' AND status = 'ACTIVE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "_DatasetEntryToDatasetTopic" existing
    JOIN "DatasetTopic" existing_topic ON existing_topic.id = existing."B"
    WHERE existing."A" = de.id AND existing_topic.status = 'ACTIVE'
  )
ON CONFLICT DO NOTHING;
