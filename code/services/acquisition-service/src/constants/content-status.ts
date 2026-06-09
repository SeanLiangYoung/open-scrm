/** acquisition.content.status — 与 docs/plans/2026-06-05-ai-native-creation-center.md 一致 */
export const CONTENT_STATUS = {
  DRAFT: 0,
  PUBLISHED: 1,
  FAILED: 2,
  PUBLISHING: 3,
} as const;

export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];
