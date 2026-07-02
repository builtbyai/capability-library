import { z } from 'zod';

const Iso = z.string();
const Url = z.string().url();

export const PredictionStatus = z.enum([
  'starting',
  'processing',
  'succeeded',
  'failed',
  'canceled',
]);
export type PredictionStatus = z.infer<typeof PredictionStatus>;

export const PredictionSource = z.enum(['api', 'web']);
export type PredictionSource = z.infer<typeof PredictionSource>;

export const WebhookEvent = z.enum(['start', 'output', 'logs', 'completed']);
export type WebhookEvent = z.infer<typeof WebhookEvent>;

export const PredictionUrls = z
  .object({
    web: Url.optional(),
    get: Url,
    cancel: Url.optional(),
    stream: Url.optional(),
  })
  .passthrough();

export const PredictionMetrics = z
  .object({
    predict_time: z.number().optional(),
    total_time: z.number().optional(),
  })
  .passthrough();

export const Prediction = z
  .object({
    id: z.string(),
    model: z.string(),
    version: z.string().nullable().optional(),
    input: z.record(z.any()).nullable().optional(),
    output: z.unknown().nullable().optional(),
    logs: z.string().nullable().optional(),
    error: z.unknown().nullable().optional(),
    status: PredictionStatus,
    created_at: Iso,
    started_at: Iso.nullable().optional(),
    completed_at: Iso.nullable().optional(),
    source: PredictionSource.optional(),
    data_removed: z.boolean().optional(),
    metrics: PredictionMetrics.optional(),
    urls: PredictionUrls,
  })
  .passthrough();
export type Prediction = z.infer<typeof Prediction>;

export const ModelVersion = z
  .object({
    id: z.string(),
    created_at: Iso,
    cog_version: z.string().optional(),
    openapi_schema: z.record(z.any()).optional(),
  })
  .passthrough();
export type ModelVersion = z.infer<typeof ModelVersion>;

export const Model = z
  .object({
    url: Url.optional(),
    owner: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    visibility: z.enum(['public', 'private']),
    github_url: Url.nullable().optional(),
    paper_url: Url.nullable().optional(),
    license_url: Url.nullable().optional(),
    run_count: z.number().int().nonnegative().optional(),
    cover_image_url: Url.nullable().optional(),
    default_example: Prediction.nullable().optional(),
    latest_version: ModelVersion.nullable().optional(),
  })
  .passthrough();
export type Model = z.infer<typeof Model>;

export const SearchModelMetadata = z
  .object({
    generated_description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    score: z.number().optional(),
  })
  .passthrough();

export const SearchModel = Model.and(
  z.object({ metadata: SearchModelMetadata.optional() }),
);
export type SearchModel = z.infer<typeof SearchModel>;

export const Hardware = z
  .object({
    name: z.string(),
    sku: z.string(),
  })
  .passthrough();
export type Hardware = z.infer<typeof Hardware>;

export const Account = z
  .object({
    type: z.enum(['user', 'organization']),
    username: z.string(),
    name: z.string().nullable().optional(),
    avatar_url: Url.nullable().optional(),
    github_url: Url.nullable().optional(),
  })
  .passthrough();
export type Account = z.infer<typeof Account>;

export const DeploymentRelease = z
  .object({
    number: z.number().int(),
    model: z.string(),
    version: z.string(),
    created_at: Iso,
    created_by: Account.optional(),
    configuration: z
      .object({
        hardware: z.string(),
        min_instances: z.number().int().nonnegative(),
        max_instances: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

export const Deployment = z
  .object({
    owner: z.string(),
    name: z.string(),
    current_release: DeploymentRelease.nullable().optional(),
  })
  .passthrough();
export type Deployment = z.infer<typeof Deployment>;

export const TrainingStatus = PredictionStatus;
export type TrainingStatus = z.infer<typeof TrainingStatus>;

export const Training = z
  .object({
    id: z.string(),
    model: z.string(),
    version: z.string(),
    input: z.record(z.any()).optional(),
    output: z.unknown().nullable().optional(),
    logs: z.string().nullable().optional(),
    error: z.unknown().nullable().optional(),
    status: TrainingStatus,
    created_at: Iso,
    started_at: Iso.nullable().optional(),
    completed_at: Iso.nullable().optional(),
    source: PredictionSource.optional(),
    metrics: PredictionMetrics.optional(),
    urls: PredictionUrls,
  })
  .passthrough();
export type Training = z.infer<typeof Training>;

export const Collection = z
  .object({
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    full_description: z.string().nullable().optional(),
    models: z.array(Model).optional(),
  })
  .passthrough();
export type Collection = z.infer<typeof Collection>;

export const WebhookSecret = z
  .object({ key: z.string() })
  .passthrough();
export type WebhookSecret = z.infer<typeof WebhookSecret>;

export const Paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    next: z.string().url().nullable(),
    previous: z.string().url().nullable(),
    results: z.array(item),
  });
export type Paginated<T> = {
  next: string | null;
  previous: string | null;
  results: T[];
};
