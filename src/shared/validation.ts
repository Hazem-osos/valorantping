import { z } from 'zod'
import {
  DEFAULT_INTERVAL_MS,
  DEFAULT_SPIKE_THRESHOLD_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TRACE_HOPS,
  MAX_INTERVAL_MS,
  MAX_TARGETS,
  MAX_TIMEOUT_MS,
  MAX_TRACE_HOPS,
  MIN_INTERVAL_MS,
  MIN_TIMEOUT_MS,
  MIN_TRACE_HOPS
} from './constants'

export const HOST_PATTERN =
  /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)$/

export const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(HOST_PATTERN, 'Host must be a hostname or IP address')

export const probeTargetSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(80),
  host: hostSchema,
  kind: z.enum(['gateway', 'isp', 'public', 'regional']),
  protocol: z.enum(['icmp', 'tcp']),
  port: z.number().int().min(1).max(65535).optional()
})

export const probeStartSchema = z
  .object({
    intervalMs: z.number().int().min(MIN_INTERVAL_MS).max(MAX_INTERVAL_MS).default(DEFAULT_INTERVAL_MS),
    timeoutMs: z.number().int().min(MIN_TIMEOUT_MS).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
    spikeThresholdMs: z.number().min(20).max(500).default(DEFAULT_SPIKE_THRESHOLD_MS),
    includeGateway: z.boolean().default(true),
    targets: z.array(probeTargetSchema).max(MAX_TARGETS)
  })
  .superRefine((value, ctx) => {
    for (const target of value.targets) {
      if (target.protocol === 'tcp' && !target.port) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TCP target ${target.id} requires a port`
        })
      }
    }
  })

export const tracerouteInputSchema = z.object({
  host: hostSchema,
  maxHops: z.number().int().min(MIN_TRACE_HOPS).max(MAX_TRACE_HOPS).default(DEFAULT_TRACE_HOPS),
  timeoutMs: z.number().int().min(500).max(5000).default(1000)
})

export const valorantStartSchema = z.object({
  label: z.string().trim().min(1).max(80)
})

export const valorantSampleSchema = z.object({
  rttMs: z.number().min(0).max(5000),
  lossPct: z.number().min(0).max(100).optional(),
  note: z.string().trim().max(160).optional()
})

export const idSchema = z.string().uuid()
export const snapshotLabelSchema = z.string().trim().min(1).max(80)
export const compareSchema = z.object({
  beforeId: idSchema,
  afterId: idSchema
})

export const applyOptimizeSchema = z.object({
  actionId: z.string().trim().min(1).max(80),
  confirm: z.literal(true),
  mtuConfirm: z.boolean().optional()
})

export const abRunSchema = z.object({
  actionId: z.string().trim().min(1).max(80),
  confirm: z.literal(true),
  mtuConfirm: z.boolean().optional()
})

export const valorantReportSchema = z.object({
  beforeId: idSchema,
  afterId: idSchema
})

export const rollbackSchema = z.object({
  backupId: idSchema
})

export const attachValorantSchema = z.object({
  sessionId: idSchema,
  rttMs: z.number().min(0).max(5000),
  lossPct: z.number().min(0).max(100).optional(),
  note: z.string().trim().max(160).optional()
})

export const baselineSchema = z.object({
  sessionId: idSchema
})

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  return schema.parse(value)
}
