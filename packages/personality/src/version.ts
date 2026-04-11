import { loadPersonality } from "./loader.js";

const personality = loadPersonality();

export const PERSONALITY_VERSION = personality.version;
export const PERSONALITY_CONTENT_HASH = personality.contentHash;
