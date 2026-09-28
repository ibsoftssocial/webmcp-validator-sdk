import { z } from 'zod';

/**
 * JSON Schema Property schema representation for WebMCP parameters
 */
export const JSONSchemaPropertySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']).optional(),
    description: z.string().optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    default: z.unknown().optional(),
    items: JSONSchemaPropertySchema.optional(),
    properties: z.record(z.string(), JSONSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    format: z.string().optional(),
  })
);

export type JSONSchemaProperty = z.infer<typeof JSONSchemaPropertySchema>;

/**
 * JSON Schema object for tool inputSchema
 */
export const JSONSchemaObjectSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), JSONSchemaPropertySchema).optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
  additionalProperties: z.boolean().optional(),
});

export type JSONSchemaObject = z.infer<typeof JSONSchemaObjectSchema>;

/**
 * Behavioral annotation hints according to W3C WebMCP draft
 */
export const ToolAnnotationsSchema = z.object({
  /** Indicates tool only reads data and produces no side effects */
  readOnlyHint: z.boolean().optional(),
  /** Indicates tool can mutate, delete, or perform destructive operations */
  destructiveHint: z.boolean().optional(),
  /** Indicates explicit user confirmation is requested before executing */
  confirmationHint: z.boolean().optional(),
  /** Indicates operation may take extended duration */
  longRunningHint: z.boolean().optional(),
  /** Human-readable title for permission/consent dialogues */
  title: z.string().optional(),
});

export type ToolAnnotations = z.infer<typeof ToolAnnotationsSchema>;

/**
 * Canonical WebMCP Tool Definition schema
 */
export const ToolDefinitionSchema = z.object({
  /** Unique tool identifier (lowercase, alphanumeric, hyphens, underscores, dots) */
  name: z.string().min(1).max(64),
  /** Natural language description explaining what the tool does to an LLM */
  description: z.string().min(1),
  /** Input parameters JSON Schema */
  inputSchema: JSONSchemaObjectSchema,
  /** Optional behavioral annotations */
  annotations: ToolAnnotationsSchema.optional(),
  /** Optional metadata about the tool source / location */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
