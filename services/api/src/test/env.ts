// Connection settings for the integration tests (Docker Compose defaults, local only).
export const OWNER = process.env.OWNER_DATABASE_URL ?? 'postgres://docsmart:docsmart@127.0.0.1:5432/docsmart';
export const TEST_DB = 'docsmart_test';
export const OWNER_TEST = OWNER.replace(/\/[^/]+$/, `/${TEST_DB}`);
export const APP_ROLE = 'docsmart_app_test';
export const APP_PASSWORD = 'docsmart-app-test-only';
export const APP_TEST = OWNER_TEST.replace(/\/\/[^@]+@/, `//${APP_ROLE}:${APP_PASSWORD}@`);
export const S3 = {
  endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:8333',
  region: process.env.S3_REGION ?? 'us-east-1',
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'docsmart',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'docsmart-local-only',
};
export const TEST_BUCKET = 'evidence-test';
