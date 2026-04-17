-- Add two-tier registry: DatasetProvider (compendium) → DatasetEntry (leaf).
-- Providers carry the search recipe an agent needs to query the catalog;
-- without them the registry can only name OpenNeuro, not search inside it.

CREATE TYPE "DatasetProviderSearchKind" AS ENUM ('GRAPHQL', 'REST', 'HTML');

CREATE TABLE "DatasetProvider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "searchKind" "DatasetProviderSearchKind",
    "searchEndpoint" TEXT,
    "searchQueryTemplate" TEXT,
    "datasetUrlTemplate" TEXT,
    "agentInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatasetProvider_slug_key" ON "DatasetProvider"("slug");
CREATE UNIQUE INDEX "DatasetProvider_domain_key" ON "DatasetProvider"("domain");
CREATE INDEX "DatasetProvider_domain_idx" ON "DatasetProvider"("domain");

ALTER TABLE "DatasetEntry" ADD COLUMN "providerId" TEXT;
CREATE INDEX "DatasetEntry_providerId_idx" ON "DatasetEntry"("providerId");

ALTER TABLE "DatasetEntry"
ADD CONSTRAINT "DatasetEntry_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "DatasetProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the providers that actually matter. Each row carries a working search
-- recipe the agent can execute without hardcoded knowledge.
INSERT INTO "DatasetProvider"
    ("id", "slug", "name", "homeUrl", "domain", "description", "searchKind", "searchEndpoint", "searchQueryTemplate", "datasetUrlTemplate", "agentInstructions", "createdAt", "updatedAt")
VALUES
    (
        'prov_openneuro',
        'openneuro',
        'OpenNeuro',
        'https://openneuro.org',
        'openneuro.org',
        'Public archive of BIDS-formatted neuroimaging datasets (MRI, fMRI, EEG, iEEG, MEG, PET).',
        'GRAPHQL',
        'https://openneuro.org/crn/graphql',
        'query Search($q: String!) { datasets(first: 25, query: { text: $q }) { edges { node { id latestSnapshot { description { Name SeniorAuthor Authors } } } } } }',
        'https://openneuro.org/datasets/{datasetId}/versions/{version}',
        'Use the GraphQL endpoint to search across datasets. Each dataset is BIDS-formatted; ask the user for modality (MRI/EEG/iEEG/MEG/PET) if unclear. Dataset IDs look like ds000000. Compose the dataset URL via datasetUrlTemplate.',
        NOW(),
        NOW()
    ),
    (
        'prov_huggingface_datasets',
        'huggingface-datasets',
        'Hugging Face Datasets',
        'https://huggingface.co/datasets',
        'huggingface.co',
        'Hub for machine-learning datasets across NLP, vision, audio, and multimodal tasks. Supports rich facet filtering.',
        'REST',
        'https://huggingface.co/api/datasets',
        'https://huggingface.co/api/datasets?search={q}&limit=25&full=true',
        'https://huggingface.co/datasets/{datasetId}',
        'Use the REST endpoint (GET); pass ''search'' for free text and optional ''filter'' params like task_categories, language, size_categories. datasetId is the owner/name slug returned by the API.',
        NOW(),
        NOW()
    ),
    (
        'prov_kaggle',
        'kaggle',
        'Kaggle Datasets',
        'https://www.kaggle.com/datasets',
        'kaggle.com',
        'Community dataset platform with tabular, image, and domain datasets; many downloads require a Kaggle account.',
        'REST',
        'https://www.kaggle.com/api/v1/datasets/list',
        'https://www.kaggle.com/api/v1/datasets/list?search={q}&page=1',
        'https://www.kaggle.com/datasets/{datasetId}',
        'Requires Kaggle API credentials (Basic auth). Free-text search via ''search''. datasetId is owner/slug. If credentials are unavailable, fall back to the HTML search page (https://www.kaggle.com/datasets?search={q}).',
        NOW(),
        NOW()
    ),
    (
        'prov_zenodo',
        'zenodo',
        'Zenodo',
        'https://zenodo.org',
        'zenodo.org',
        'Open research data repository operated by CERN; assigns DOIs and hosts datasets across all fields of science.',
        'REST',
        'https://zenodo.org/api/records',
        'https://zenodo.org/api/records?q={q}&type=dataset&size=25',
        'https://zenodo.org/records/{recordId}',
        'Use GET on the REST endpoint. Filter by type=dataset. recordId is the numeric id field. Results include DOIs via metadata.doi.',
        NOW(),
        NOW()
    ),
    (
        'prov_physionet',
        'physionet',
        'PhysioNet',
        'https://physionet.org',
        'physionet.org',
        'MIT-hosted repository of physiologic signals and clinical datasets (ECG, PPG, sleep, MIMIC, etc.).',
        'HTML',
        'https://physionet.org/content/',
        'https://physionet.org/content/?topic={q}',
        'https://physionet.org/content/{datasetSlug}/{version}/',
        'No public JSON API. Scrape the HTML listing at /content/?topic=... Some datasets require credentialed access (DUA signing); surface that requirement to the user.',
        NOW(),
        NOW()
    ),
    (
        'prov_uk_biobank',
        'uk-biobank',
        'UK Biobank',
        'https://www.ukbiobank.ac.uk',
        'ukbiobank.ac.uk',
        'Large-scale biomedical cohort (~500k participants) with imaging, genomics, lifestyle, and linked health records.',
        'HTML',
        'https://biobank.ndph.ox.ac.uk/showcase/search.cgi',
        'https://biobank.ndph.ox.ac.uk/showcase/search.cgi?wd={q}',
        'https://biobank.ndph.ox.ac.uk/showcase/field.cgi?id={fieldId}',
        'Access requires an approved UK Biobank application. Use Data Showcase search for field discovery. Always surface access restrictions to the user before promising data.',
        NOW(),
        NOW()
    ),
    (
        'prov_figshare',
        'figshare',
        'figshare',
        'https://figshare.com',
        'figshare.com',
        'General-purpose research data repository with DOIs, supports datasets, figures, and media.',
        'REST',
        'https://api.figshare.com/v2/articles/search',
        '{"search_for": "{q}", "item_type": 3, "page_size": 25}',
        'https://figshare.com/articles/dataset/{slug}/{articleId}',
        'POST JSON to the search endpoint; item_type 3 = dataset. articleId is the numeric id; slug is the url_name.',
        NOW(),
        NOW()
    ),
    (
        'prov_osf',
        'osf',
        'OSF',
        'https://osf.io',
        'osf.io',
        'Open Science Framework: projects, registrations, and preprints with attached datasets.',
        'REST',
        'https://api.osf.io/v2/nodes/',
        'https://api.osf.io/v2/nodes/?filter[tags]=dataset&filter[title]={q}',
        'https://osf.io/{nodeId}/',
        'Use the JSON:API endpoints. Prefer filter[tags]=dataset to narrow. nodeId is the short 5-char id.',
        NOW(),
        NOW()
    ),
    (
        'prov_papers_with_code',
        'papers-with-code',
        'Papers with Code',
        'https://paperswithcode.com',
        'paperswithcode.com',
        'Benchmark hub pairing datasets with SOTA papers and code.',
        'REST',
        'https://paperswithcode.com/api/v1/datasets/',
        'https://paperswithcode.com/api/v1/datasets/?q={q}',
        'https://paperswithcode.com/dataset/{datasetSlug}',
        'Public REST API, no auth. Good for benchmark datasets tied to ML tasks (classification, detection, QA, etc.).',
        NOW(),
        NOW()
    ),
    (
        'prov_openml',
        'openml',
        'OpenML',
        'https://www.openml.org',
        'openml.org',
        'ML benchmark platform with curated tabular datasets, tasks, and runs.',
        'REST',
        'https://www.openml.org/api/v1/json/data/list',
        'https://www.openml.org/api/v1/json/data/list/data_name/{q}/limit/25',
        'https://www.openml.org/d/{datasetId}',
        'REST returns JSON. datasetId is the numeric OpenML data id. Tasks/benchmarks are available via /task/list.',
        NOW(),
        NOW()
    );

-- Backfill existing DatasetEntry rows by matching domain → provider.
-- Distinct existing domains not listed above are inserted as stub providers
-- so every leaf has a parent; ops can fill in search metadata later.
INSERT INTO "DatasetProvider" ("id", "slug", "name", "homeUrl", "domain", "description", "createdAt", "updatedAt")
SELECT
    'prov_auto_' || md5(de.domain),
    regexp_replace(lower(de.domain), '[^a-z0-9]+', '-', 'g'),
    initcap(replace(split_part(de.domain, '.', 1), '-', ' ')),
    'https://' || de.domain,
    de.domain,
    'Auto-linked from existing dataset entries.',
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT "domain" FROM "DatasetEntry"
    WHERE "domain" IS NOT NULL AND length("domain") > 0
) AS de
ON CONFLICT ("domain") DO NOTHING;

UPDATE "DatasetEntry" e
SET "providerId" = p.id
FROM "DatasetProvider" p
WHERE e."domain" = p."domain" AND e."providerId" IS NULL;
