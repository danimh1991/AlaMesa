declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    RECIPE_API_TOKEN?: string;
    RECIPE_API_ALLOWED_ORIGINS?: string;
    LLM_CORE_URL?: string;
    LLM_CORE_API_KEY?: string;
    LLM_RECIPE_AGENT_ID?: string;
    LLM_SUBJECT_ID?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
