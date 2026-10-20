declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    RECIPE_API_TOKEN?: string;
    RECIPE_API_ALLOWED_ORIGINS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
