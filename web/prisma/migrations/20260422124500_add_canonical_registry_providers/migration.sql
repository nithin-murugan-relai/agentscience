-- Add canonical providers for common scientific registry sources that are
-- already appearing in the dataset registry via paper-backed sync. This lets
-- strict standalone CLI adds target real provider rows instead of stub domains.

INSERT INTO "DatasetProvider"
    ("id", "slug", "name", "homeUrl", "domain", "description", "searchKind", "searchEndpoint", "searchQueryTemplate", "datasetUrlTemplate", "agentInstructions", "createdAt", "updatedAt")
VALUES
    (
        'prov_geo',
        'geo',
        'GEO',
        'https://www.ncbi.nlm.nih.gov/geo/',
        'ncbi.nlm.nih.gov',
        'NCBI Gene Expression Omnibus for public transcriptomics, genomics, and functional genomics accessions.',
        'HTML',
        'https://www.ncbi.nlm.nih.gov/gds',
        'https://www.ncbi.nlm.nih.gov/gds/?term={q}',
        'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={accession}',
        'Use GEO accession pages as canonical dataset URLs. Search by disease, assay, or accession (for example GSE12345). Prefer public Series pages over ad hoc download URLs.',
        NOW(),
        NOW()
    ),
    (
        'prov_cbioportal',
        'cbioportal',
        'cBioPortal',
        'https://www.cbioportal.org',
        'cbioportal.org',
        'Cancer genomics portal with public study pages, molecular profiles, and clinical annotations.',
        'REST',
        'https://www.cbioportal.org/api/studies',
        'https://www.cbioportal.org/api/studies?projection=SUMMARY',
        'https://www.cbioportal.org/study/summary?id={studyId}',
        'Use public study summary pages as canonical dataset URLs. Study identifiers look like lgggbm_tcga_pub. Confirm the study is public before registering it.',
        NOW(),
        NOW()
    ),
    (
        'prov_stjude_cloud',
        'stjude-cloud',
        'St. Jude Cloud',
        'https://www.stjude.cloud',
        'stjude.cloud',
        'Pediatric cancer and genomics cloud platform with public study pages, harmonized omics data, and analysis apps.',
        'HTML',
        'https://www.stjude.cloud/studies',
        'https://www.stjude.cloud/studies',
        'https://www.stjude.cloud/studies/{studySlug}',
        'Use study pages under /studies/{studySlug} as canonical dataset URLs. These are the stable public entry points for St. Jude Cloud cohorts and programs.',
        NOW(),
        NOW()
    ),
    (
        'prov_sdss',
        'sdss',
        'SDSS',
        'https://www.sdss.org',
        'sdss.org',
        'Sloan Digital Sky Survey public data releases for spectra, catalogs, imaging, and derived astronomy products.',
        'HTML',
        'https://www.sdss.org/science/publications/data-release-publications/',
        'https://www.sdss.org/science/publications/data-release-publications/',
        'https://www.sdss.org/dr{release}/data_access/get_data',
        'Register canonical SDSS data-release pages, not ad hoc file URLs. Release identifiers look like 19 in DR19.',
        NOW(),
        NOW()
    )
ON CONFLICT ("domain") DO UPDATE
SET
    "slug" = EXCLUDED."slug",
    "name" = EXCLUDED."name",
    "homeUrl" = EXCLUDED."homeUrl",
    "description" = EXCLUDED."description",
    "searchKind" = EXCLUDED."searchKind",
    "searchEndpoint" = EXCLUDED."searchEndpoint",
    "searchQueryTemplate" = EXCLUDED."searchQueryTemplate",
    "datasetUrlTemplate" = EXCLUDED."datasetUrlTemplate",
    "agentInstructions" = EXCLUDED."agentInstructions",
    "updatedAt" = NOW();

DELETE FROM "_DatasetProviderToDatasetTopic"
WHERE "A" IN (
    SELECT id FROM "DatasetProvider" WHERE slug IN ('geo', 'cbioportal', 'stjude-cloud', 'sdss')
)
AND "B" = 'topic_interdisciplinary';

INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_genomics' FROM "DatasetProvider" WHERE slug = 'geo'
ON CONFLICT DO NOTHING;
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_transcriptomics' FROM "DatasetProvider" WHERE slug = 'geo'
ON CONFLICT DO NOTHING;
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_clinical_records' FROM "DatasetProvider" WHERE slug = 'geo'
ON CONFLICT DO NOTHING;

INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_genomics' FROM "DatasetProvider" WHERE slug = 'cbioportal'
ON CONFLICT DO NOTHING;
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_clinical_records' FROM "DatasetProvider" WHERE slug = 'cbioportal'
ON CONFLICT DO NOTHING;

INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_genomics' FROM "DatasetProvider" WHERE slug = 'stjude-cloud'
ON CONFLICT DO NOTHING;
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_transcriptomics' FROM "DatasetProvider" WHERE slug = 'stjude-cloud'
ON CONFLICT DO NOTHING;
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_clinical_records' FROM "DatasetProvider" WHERE slug = 'stjude-cloud'
ON CONFLICT DO NOTHING;

INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT id, 'topic_astronomy' FROM "DatasetProvider" WHERE slug = 'sdss'
ON CONFLICT DO NOTHING;
