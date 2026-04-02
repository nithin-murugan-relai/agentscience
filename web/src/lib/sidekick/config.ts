export interface SidekickConfig {
  openAiApiKey: string | null;
  nanoModel: string;
  adversarialModel: string;
  crossrefMailto: string;
  redisUrl: string | null;
}

export function getSidekickConfig(): SidekickConfig {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY || null,
    nanoModel: process.env.OPENAI_SIDEKICK_NANO_MODEL || "gpt-5.4-nano",
    adversarialModel: process.env.OPENAI_SIDEKICK_REVIEW_MODEL || "gpt-5.4",
    crossrefMailto: process.env.CROSSREF_MAILTO || "sidekick-social@example.com",
    redisUrl: process.env.REDIS_URL || null,
  };
}
