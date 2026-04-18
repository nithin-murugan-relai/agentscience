-- Add the dataset taxonomy: a closed Area enum + open-ish Topic vocabulary.
-- Providers and datasets can be multi-tagged with topics; areas are derived
-- from a topic's parent area, keeping the schema flat (2 levels only).
--
-- Topics are soft-closed: agents can propose new ones via the
-- /api/v1/registry/topics/suggestions endpoint, which lands as PENDING.
-- Only ACTIVE topics show up in public surfaces.

CREATE TYPE "DatasetArea" AS ENUM (
  'LIFE_SCIENCES',
  'MEDICINE_HEALTH',
  'SOCIAL_SCIENCES',
  'PHYSICAL_SCIENCES',
  'EARTH_ENVIRONMENT',
  'COMPUTING_ENGINEERING',
  'MATH_STATISTICS',
  'HUMANITIES',
  'OTHER'
);

CREATE TYPE "DatasetTopicStatus" AS ENUM ('ACTIVE', 'PENDING');

CREATE TABLE "DatasetTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" "DatasetArea" NOT NULL,
    "description" TEXT,
    "agentInstructions" TEXT,
    "status" "DatasetTopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetTopic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatasetTopic_slug_key" ON "DatasetTopic"("slug");
CREATE INDEX "DatasetTopic_area_idx" ON "DatasetTopic"("area");
CREATE INDEX "DatasetTopic_status_idx" ON "DatasetTopic"("status");

-- Implicit many-to-many join tables (Prisma-managed naming).
CREATE TABLE "_DatasetProviderToDatasetTopic" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DatasetProviderToDatasetTopic_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_DatasetProviderToDatasetTopic_B_index"
    ON "_DatasetProviderToDatasetTopic"("B");

ALTER TABLE "_DatasetProviderToDatasetTopic"
    ADD CONSTRAINT "_DatasetProviderToDatasetTopic_A_fkey"
    FOREIGN KEY ("A") REFERENCES "DatasetProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DatasetProviderToDatasetTopic"
    ADD CONSTRAINT "_DatasetProviderToDatasetTopic_B_fkey"
    FOREIGN KEY ("B") REFERENCES "DatasetTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_DatasetEntryToDatasetTopic" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DatasetEntryToDatasetTopic_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_DatasetEntryToDatasetTopic_B_index"
    ON "_DatasetEntryToDatasetTopic"("B");

ALTER TABLE "_DatasetEntryToDatasetTopic"
    ADD CONSTRAINT "_DatasetEntryToDatasetTopic_A_fkey"
    FOREIGN KEY ("A") REFERENCES "DatasetEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DatasetEntryToDatasetTopic"
    ADD CONSTRAINT "_DatasetEntryToDatasetTopic_B_fkey"
    FOREIGN KEY ("B") REFERENCES "DatasetTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed canonical topics across all 9 areas. ~40 topics spanning the main
-- research vocabularies we expect agents to encounter. Each topic carries
-- agent-facing instructions explaining what belongs here and how to
-- discriminate sub-niches via keywords (e.g. "viral epidemiology" lives as
-- a keyword on an epidemiology dataset, not as its own topic tree node).
INSERT INTO "DatasetTopic"
    ("id", "slug", "name", "area", "description", "agentInstructions", "status", "createdAt", "updatedAt")
VALUES
    -- LIFE_SCIENCES
    ('topic_genomics', 'genomics', 'Genomics', 'LIFE_SCIENCES',
     'Whole-genome and genome-scale sequence, variant, and annotation data.',
     'Use for genome assemblies, variant call sets (VCF), reference genomes, and sequencing runs. If the dataset is about RNA expression tag transcriptomics instead. Clinical genomics also cross-tag with clinical-records.',
     'ACTIVE', NOW(), NOW()),
    ('topic_transcriptomics', 'transcriptomics', 'Transcriptomics', 'LIFE_SCIENCES',
     'RNA sequencing, microarrays, and gene-expression measurements.',
     'Use for bulk RNA-seq, single-cell RNA-seq, microarrays, and expression matrices. Cross-tag with cell-biology for single-cell atlases.',
     'ACTIVE', NOW(), NOW()),
    ('topic_proteomics', 'proteomics', 'Proteomics', 'LIFE_SCIENCES',
     'Protein abundance, post-translational modifications, and interaction maps.',
     'Use for mass-spec proteomics, interactome studies, and structure-function datasets.',
     'ACTIVE', NOW(), NOW()),
    ('topic_neuroscience', 'neuroscience', 'Neuroscience', 'LIFE_SCIENCES',
     'Nervous system structure, function, and behavior at any scale.',
     'Use broadly for neural data. For imaging modalities cross-tag neuroimaging. For cognitive / behavioral paradigms cross-tag psychology. For clinical brain data also cross-tag mental-health or medical-imaging.',
     'ACTIVE', NOW(), NOW()),
    ('topic_neuroimaging', 'neuroimaging', 'Neuroimaging', 'LIFE_SCIENCES',
     'Brain imaging: MRI, fMRI, PET, EEG, MEG, iEEG, ECoG.',
     'Use for any dataset with brain imaging data regardless of modality. Always cross-tag neuroscience. If the dataset is clinical (patients, diagnosis), also cross-tag medical-imaging.',
     'ACTIVE', NOW(), NOW()),
    ('topic_cell_biology', 'cell-biology', 'Cell Biology', 'LIFE_SCIENCES',
     'Cellular structure, organelles, single-cell measurements, and imaging.',
     'Use for cell atlases, microscopy of cells, and subcellular assays.',
     'ACTIVE', NOW(), NOW()),
    ('topic_microbiology', 'microbiology', 'Microbiology', 'LIFE_SCIENCES',
     'Microbes, microbiome composition, and microbial genomics.',
     'Use for 16S/shotgun microbiome studies, pathogen genomics (cross-tag epidemiology for outbreak data), and microbial phenotype screens.',
     'ACTIVE', NOW(), NOW()),
    ('topic_ecology', 'ecology', 'Ecology', 'LIFE_SCIENCES',
     'Species occurrence, biodiversity, ecosystems, and environmental interactions.',
     'Use for biodiversity observations (GBIF-style), camera traps, ecological surveys. Cross-tag remote-sensing for satellite-derived ecology.',
     'ACTIVE', NOW(), NOW()),
    ('topic_evolution', 'evolution', 'Evolutionary Biology', 'LIFE_SCIENCES',
     'Phylogenetics, population genetics, and ancestry.',
     'Use for sequence alignments, phylogenetic trees, and ancient DNA. Cross-tag genomics when sequencing data is primary.',
     'ACTIVE', NOW(), NOW()),

    -- MEDICINE_HEALTH
    ('topic_clinical_trials', 'clinical-trials', 'Clinical Trials', 'MEDICINE_HEALTH',
     'Randomized controlled trials, trial registries, and patient-level outcomes.',
     'Use for aggregated or patient-level trial data. If outcome data is imaging cross-tag medical-imaging; if it is pharmacology cross-tag pharmacology.',
     'ACTIVE', NOW(), NOW()),
    ('topic_epidemiology', 'epidemiology', 'Epidemiology', 'MEDICINE_HEALTH',
     'Disease distribution, outbreaks, surveillance, and population health patterns.',
     'Use for outbreak datasets (COVID, flu, Ebola), surveillance time series, burden-of-disease studies. "Viral epidemiology" and "genomic epidemiology" live here; cross-tag microbiology or genomics for pathogen-level data.',
     'ACTIVE', NOW(), NOW()),
    ('topic_medical_imaging', 'medical-imaging', 'Medical Imaging', 'MEDICINE_HEALTH',
     'Clinical imaging: radiology, pathology, ultrasound, ophthalmology.',
     'Use for CT, X-ray, MRI with clinical labels, histopathology, retinal imaging, and dermatology photos. For brain imaging cross-tag neuroimaging.',
     'ACTIVE', NOW(), NOW()),
    ('topic_public_health', 'public-health', 'Public Health', 'MEDICINE_HEALTH',
     'Population-level health, social determinants, and health-system data.',
     'Use for health surveys (NHANES, BRFSS), vaccination coverage, health-equity studies. Often cross-tags with demographics.',
     'ACTIVE', NOW(), NOW()),
    ('topic_pharmacology', 'pharmacology', 'Pharmacology', 'MEDICINE_HEALTH',
     'Drug data, compound libraries, drug-target interactions, and adverse events.',
     'Use for screening libraries, bioactivity, ADMET, and pharmacokinetics. Cross-tag clinical-trials for in-human studies.',
     'ACTIVE', NOW(), NOW()),
    ('topic_mental_health', 'mental-health', 'Mental Health', 'MEDICINE_HEALTH',
     'Psychiatric diagnoses, symptom scales, and treatment outcomes.',
     'Use for clinical mental health datasets. If the paradigm is experimental / cognitive cross-tag psychology; if measurements include brain imaging cross-tag neuroimaging.',
     'ACTIVE', NOW(), NOW()),
    ('topic_clinical_records', 'clinical-records', 'Clinical Records', 'MEDICINE_HEALTH',
     'EHR, EMR, and de-identified clinical narratives.',
     'Use for MIMIC-style critical-care records, de-identified notes, and billing codes. Respect access controls; many require DUA signing.',
     'ACTIVE', NOW(), NOW()),

    -- SOCIAL_SCIENCES
    ('topic_psychology', 'psychology', 'Psychology', 'SOCIAL_SCIENCES',
     'Behavioral, cognitive, developmental, and clinical psychology.',
     'Use for experimental psych paradigms and survey-based personality / cognition studies. For cognitive neuroscience also cross-tag neuroscience; for clinical populations cross-tag mental-health.',
     'ACTIVE', NOW(), NOW()),
    ('topic_economics', 'economics', 'Economics', 'SOCIAL_SCIENCES',
     'Macro, micro, financial, and labor-market data.',
     'Use for central-bank releases, labor surveys, price indices, household finance. Cross-tag statistics when the dataset is method-focused.',
     'ACTIVE', NOW(), NOW()),
    ('topic_sociology', 'sociology', 'Sociology', 'SOCIAL_SCIENCES',
     'Social structure, networks, inequality, and survey research.',
     'Use for longitudinal social surveys, family/household studies, and social-network data.',
     'ACTIVE', NOW(), NOW()),
    ('topic_political_science', 'political-science', 'Political Science', 'SOCIAL_SCIENCES',
     'Voting records, polling, governance, and conflict data.',
     'Use for election returns, roll calls, polling aggregates, and conflict-event datasets.',
     'ACTIVE', NOW(), NOW()),
    ('topic_anthropology', 'anthropology', 'Anthropology', 'SOCIAL_SCIENCES',
     'Ethnographic, cultural, and archaeological data.',
     'Use for ethnographic corpora, archaeological site records, and cultural inventories.',
     'ACTIVE', NOW(), NOW()),
    ('topic_education', 'education', 'Education', 'SOCIAL_SCIENCES',
     'Learning analytics, assessment, and education-system data.',
     'Use for standardized test data, MOOC traces, and school-system statistics.',
     'ACTIVE', NOW(), NOW()),
    ('topic_demographics', 'demographics', 'Demographics', 'SOCIAL_SCIENCES',
     'Population counts, migration, and vital statistics.',
     'Use for census-style data, migration flows, and fertility / mortality tables. Often cross-tags with public-health.',
     'ACTIVE', NOW(), NOW()),

    -- PHYSICAL_SCIENCES
    ('topic_physics', 'physics', 'Physics', 'PHYSICAL_SCIENCES',
     'General experimental and simulation data in physics.',
     'Use for condensed-matter, optical, plasma, and lab-scale physics. For particle physics use particle-physics; for astronomy use astronomy.',
     'ACTIVE', NOW(), NOW()),
    ('topic_astronomy', 'astronomy', 'Astronomy & Astrophysics', 'PHYSICAL_SCIENCES',
     'Sky surveys, spectra, photometry, and cosmological simulations.',
     'Use for catalogs (SDSS, Gaia), time-domain surveys, gravitational-wave strain, and cosmology sims.',
     'ACTIVE', NOW(), NOW()),
    ('topic_chemistry', 'chemistry', 'Chemistry', 'PHYSICAL_SCIENCES',
     'Molecules, reactions, spectra, and chemical properties.',
     'Use for QM9-style molecular property datasets, reaction databases, and chemical-space libraries. Cross-tag pharmacology for bioactive compounds.',
     'ACTIVE', NOW(), NOW()),
    ('topic_materials_science', 'materials-science', 'Materials Science', 'PHYSICAL_SCIENCES',
     'Material properties, crystal structures, and synthesis data.',
     'Use for Materials Project-style datasets, alloy compositions, and structure-property mappings.',
     'ACTIVE', NOW(), NOW()),
    ('topic_particle_physics', 'particle-physics', 'Particle Physics', 'PHYSICAL_SCIENCES',
     'Collider events, detector outputs, and simulation data.',
     'Use for LHC-scale event data and simulation benchmarks.',
     'ACTIVE', NOW(), NOW()),

    -- EARTH_ENVIRONMENT
    ('topic_climate', 'climate', 'Climate', 'EARTH_ENVIRONMENT',
     'Global and regional climate observations, reanalyses, and projections.',
     'Use for temperature, precipitation, carbon-cycle, and paleoclimate reconstructions. Cross-tag atmospheric-science for gas-phase composition studies.',
     'ACTIVE', NOW(), NOW()),
    ('topic_oceanography', 'oceanography', 'Oceanography', 'EARTH_ENVIRONMENT',
     'Ocean physics, biogeochemistry, and marine ecology.',
     'Use for Argo-style in-situ data, satellite sea-surface products, and ocean-biogeochemistry datasets.',
     'ACTIVE', NOW(), NOW()),
    ('topic_geology', 'geology', 'Geology', 'EARTH_ENVIRONMENT',
     'Solid-earth structure, seismology, and geochronology.',
     'Use for seismic catalogs, geological maps, and borehole data.',
     'ACTIVE', NOW(), NOW()),
    ('topic_atmospheric_science', 'atmospheric-science', 'Atmospheric Science', 'EARTH_ENVIRONMENT',
     'Atmospheric composition, air quality, and weather observations.',
     'Use for air-quality monitoring, trace-gas columns, and weather-station time series. Cross-tag climate for long-horizon studies.',
     'ACTIVE', NOW(), NOW()),
    ('topic_remote_sensing', 'remote-sensing', 'Remote Sensing', 'EARTH_ENVIRONMENT',
     'Satellite and aerial imagery of the Earth surface.',
     'Use for Sentinel / Landsat / MODIS-style products. Cross-tag ecology for biodiversity applications and climate for long-horizon analyses.',
     'ACTIVE', NOW(), NOW()),

    -- COMPUTING_ENGINEERING
    ('topic_machine_learning', 'machine-learning', 'Machine Learning', 'COMPUTING_ENGINEERING',
     'Training, evaluation, and benchmarking datasets for ML.',
     'Use for generic ML datasets. For modality-specific data also cross-tag computer-vision, natural-language-processing, etc. For task-standardized leaderboards also cross-tag benchmarks.',
     'ACTIVE', NOW(), NOW()),
    ('topic_computer_vision', 'computer-vision', 'Computer Vision', 'COMPUTING_ENGINEERING',
     'Image and video datasets for recognition, detection, and generation.',
     'Use for ImageNet-style datasets, detection/segmentation, and video understanding. Always also tag machine-learning.',
     'ACTIVE', NOW(), NOW()),
    ('topic_nlp', 'natural-language-processing', 'Natural Language Processing', 'COMPUTING_ENGINEERING',
     'Text corpora, parallel corpora, and language understanding benchmarks.',
     'Use for corpora used to train or evaluate language models. For linguistic-research corpora cross-tag linguistics.',
     'ACTIVE', NOW(), NOW()),
    ('topic_robotics', 'robotics', 'Robotics', 'COMPUTING_ENGINEERING',
     'Manipulation, navigation, and embodied-AI datasets.',
     'Use for robot demonstrations, sensor logs, and sim2real benchmarks.',
     'ACTIVE', NOW(), NOW()),
    ('topic_software_engineering', 'software-engineering', 'Software Engineering', 'COMPUTING_ENGINEERING',
     'Source code, commits, issues, and software-systems data.',
     'Use for code corpora (The Stack, CodeSearchNet), commit histories, and issue / PR datasets.',
     'ACTIVE', NOW(), NOW()),
    ('topic_cybersecurity', 'cybersecurity', 'Cybersecurity', 'COMPUTING_ENGINEERING',
     'Network traffic, malware, attacks, and vulnerabilities.',
     'Use for intrusion-detection datasets, malware corpora, and CVE-linked benchmarks.',
     'ACTIVE', NOW(), NOW()),

    -- MATH_STATISTICS
    ('topic_statistics', 'statistics', 'Statistics', 'MATH_STATISTICS',
     'Reference datasets for statistical methods and inference.',
     'Use for classic reference datasets, simulated benchmarks, and method-evaluation corpora.',
     'ACTIVE', NOW(), NOW()),
    ('topic_probability', 'probability', 'Probability', 'MATH_STATISTICS',
     'Stochastic processes, random-process traces, and simulation outputs.',
     'Use when the central object is a stochastic process or probabilistic simulation.',
     'ACTIVE', NOW(), NOW()),
    ('topic_numerical_methods', 'numerical-methods', 'Numerical Methods', 'MATH_STATISTICS',
     'Benchmarks for numerical algorithms and scientific computing.',
     'Use for PDE benchmarks, optimization problem sets, and solver test suites.',
     'ACTIVE', NOW(), NOW()),

    -- HUMANITIES
    ('topic_linguistics', 'linguistics', 'Linguistics', 'HUMANITIES',
     'Language corpora for typology, phonology, and syntax research.',
     'Use for linguistic-research corpora. For NLP task corpora cross-tag natural-language-processing.',
     'ACTIVE', NOW(), NOW()),
    ('topic_history', 'history', 'History', 'HUMANITIES',
     'Historical archives, records, and datasets.',
     'Use for digitized historical sources, treaty registers, and biographical databases.',
     'ACTIVE', NOW(), NOW()),
    ('topic_digital_humanities', 'digital-humanities', 'Digital Humanities', 'HUMANITIES',
     'Computational analysis of humanities corpora.',
     'Use for OCR-derived manuscript corpora, annotated literary texts, and cultural-analytics datasets.',
     'ACTIVE', NOW(), NOW()),
    ('topic_literature', 'literature', 'Literature', 'HUMANITIES',
     'Literary texts and annotated corpora.',
     'Use for novels, poetry, and plays curated for research. Cross-tag digital-humanities for computational analyses.',
     'ACTIVE', NOW(), NOW()),

    -- OTHER (the escape valve — still a first-class area)
    ('topic_interdisciplinary', 'interdisciplinary', 'Interdisciplinary', 'OTHER',
     'Datasets that genuinely span multiple areas and should be cross-tagged.',
     'Use when no single area dominates. ALWAYS also tag the specific topics that apply (e.g. climate + public-health + economics for a climate-health-economics dataset). This ensures the dataset still surfaces inside each area view.',
     'ACTIVE', NOW(), NOW()),
    ('topic_benchmarks', 'benchmarks', 'Benchmarks', 'OTHER',
     'Task benchmarks that ship with leaderboards, often spanning fields.',
     'Use for task-standardized benchmarks. Cross-tag the relevant ML topic (machine-learning, computer-vision, etc.) when applicable.',
     'ACTIVE', NOW(), NOW()),
    ('topic_meta_research', 'meta-research', 'Meta-Research', 'OTHER',
     'Datasets about datasets, papers, or research processes themselves.',
     'Use for citation graphs, paper metadata, retraction lists, reproducibility studies, and dataset-registry snapshots.',
     'ACTIVE', NOW(), NOW()),
    ('topic_synthetic', 'synthetic', 'Synthetic Data', 'OTHER',
     'Simulated or generated data (not observed).',
     'Use for purely synthetic benchmarks and simulation outputs. Cross-tag the substantive topic being simulated.',
     'ACTIVE', NOW(), NOW());

-- Link seeded providers to their canonical topics. Every known provider gets
-- at least one topic so the "every provider has >=1 topic" invariant holds
-- for the seed set. Auto-stub providers (created during backfill) fall back
-- to interdisciplinary further down.
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B") VALUES
    -- OpenNeuro → neuroimaging, neuroscience
    ('prov_openneuro', 'topic_neuroimaging'),
    ('prov_openneuro', 'topic_neuroscience'),
    -- Hugging Face Datasets → machine-learning, natural-language-processing, computer-vision
    ('prov_huggingface_datasets', 'topic_machine_learning'),
    ('prov_huggingface_datasets', 'topic_nlp'),
    ('prov_huggingface_datasets', 'topic_computer_vision'),
    -- Kaggle → machine-learning, benchmarks
    ('prov_kaggle', 'topic_machine_learning'),
    ('prov_kaggle', 'topic_benchmarks'),
    -- Zenodo → interdisciplinary (generic scientific repo)
    ('prov_zenodo', 'topic_interdisciplinary'),
    -- PhysioNet → clinical-records, medical-imaging, neuroscience
    ('prov_physionet', 'topic_clinical_records'),
    ('prov_physionet', 'topic_medical_imaging'),
    ('prov_physionet', 'topic_neuroscience'),
    -- UK Biobank → medical-imaging, public-health, genomics
    ('prov_uk_biobank', 'topic_medical_imaging'),
    ('prov_uk_biobank', 'topic_public_health'),
    ('prov_uk_biobank', 'topic_genomics'),
    -- figshare → interdisciplinary
    ('prov_figshare', 'topic_interdisciplinary'),
    -- OSF → interdisciplinary
    ('prov_osf', 'topic_interdisciplinary'),
    -- Papers with Code → machine-learning, benchmarks, computer-vision, natural-language-processing
    ('prov_papers_with_code', 'topic_machine_learning'),
    ('prov_papers_with_code', 'topic_benchmarks'),
    ('prov_papers_with_code', 'topic_computer_vision'),
    ('prov_papers_with_code', 'topic_nlp'),
    -- OpenML → machine-learning, benchmarks, statistics
    ('prov_openml', 'topic_machine_learning'),
    ('prov_openml', 'topic_benchmarks'),
    ('prov_openml', 'topic_statistics')
ON CONFLICT DO NOTHING;

-- Auto-stub providers created during the previous backfill don't have topics
-- yet. Assign them to interdisciplinary (OTHER) so the >=1-topic invariant
-- holds universally — ops can re-tag them to specific topics later without
-- code changes.
INSERT INTO "_DatasetProviderToDatasetTopic" ("A", "B")
SELECT p.id, 'topic_interdisciplinary'
FROM "DatasetProvider" p
LEFT JOIN "_DatasetProviderToDatasetTopic" j ON j."A" = p.id
WHERE j."A" IS NULL
ON CONFLICT DO NOTHING;
