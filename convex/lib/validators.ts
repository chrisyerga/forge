import { v } from 'convex/values'
import schema from '../schema'

// Build full document validators (table fields + system fields) for use in
// `returns` validators, derived from the schema so they stay in sync.
function docValidator<T extends keyof typeof schema.tables>(table: T) {
  return v.object({
    _id: v.id(table as string),
    _creationTime: v.number(),
    ...schema.tables[table].validator.fields,
  })
}

export const projectDoc = docValidator('projects')
export const entityDoc = docValidator('entities')
export const personaDoc = docValidator('personas')
export const styleDoc = docValidator('styles')
export const generationDoc = docValidator('generations')

// API keys are returned without the secret hash.
export const apiKeyPublic = v.object({
  _id: v.id('apiKeys'),
  _creationTime: v.number(),
  ownerId: v.id('users'),
  label: v.string(),
  prefix: v.string(),
  scopes: v.array(v.string()),
  lastUsedAt: v.optional(v.number()),
  revoked: v.boolean(),
})
