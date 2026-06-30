import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/projects')({
  component: ProjectsPage,
})

const PROJECT_KINDS = [
  'blog',
  'social_account',
  'story_series',
  'commerce_collection',
  'workspace',
  'other',
] as const

const ENTITY_KINDS = [
  'person',
  'animal',
  'pet',
  'fictional_character',
  'brand',
  'place',
  'object',
  'other',
] as const

function ProjectsPage() {
  return (
    <AppShell>
      <div className="space-y-10">
        <ProjectsSection />
        <EntitiesSection />
      </div>
    </AppShell>
  )
}

function ProjectsSection() {
  const projects = useQuery(convexQuery(api.projects.list, {}))
  const createProject = useMutation(api.projects.create)
  const removeProject = useMutation(api.projects.remove)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<(typeof PROJECT_KINDS)[number]>('workspace')
  const [description, setDescription] = useState('')

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-zinc-400">Group entities and generations by project.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_180px]"
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              void createProject({
                name: name.trim(),
                kind,
                description: description.trim() || undefined,
              }).then(() => {
                setName('')
                setDescription('')
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My blog"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-kind">Kind</Label>
              <Select
                id="project-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof PROJECT_KINDS)[number])}
              >
                {PROJECT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.data?.map((project) => (
          <Card key={project._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.kind}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeProject({ projectId: project._id })}
                >
                  Delete
                </Button>
              </div>
            </CardHeader>
            {project.description ? (
              <CardContent>
                <p className="text-sm text-zinc-400">{project.description}</p>
              </CardContent>
            ) : null}
          </Card>
        ))}
        {projects.data?.length === 0 ? (
          <p className="text-sm text-zinc-500">No projects yet.</p>
        ) : null}
      </div>
    </section>
  )
}

function EntitiesSection() {
  const entities = useQuery(convexQuery(api.entities.list, {}))
  const projects = useQuery(convexQuery(api.projects.list, {}))
  const createEntity = useMutation(api.entities.create)
  const removeEntity = useMutation(api.entities.remove)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<(typeof ENTITY_KINDS)[number]>('person')
  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [traits, setTraits] = useState('')

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Entities</h2>
        <p className="text-sm text-zinc-400">
          Reusable people, characters, brands and more, injected into generations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New entity</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              const traitList = traits
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
              void createEntity({
                name: name.trim(),
                kind,
                projectId: projectId ? (projectId as Id<'projects'>) : undefined,
                description: description.trim() || undefined,
                traits: traitList.length ? traitList : undefined,
              }).then(() => {
                setName('')
                setDescription('')
                setTraits('')
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="entity-name">Name</Label>
              <Input id="entity-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-kind">Kind</Label>
              <Select
                id="entity-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof ENTITY_KINDS)[number])}
              >
                {ENTITY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-project">Project (optional)</Label>
              <Select
                id="entity-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— none —</option>
                {projects.data?.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-traits">Traits (comma separated)</Label>
              <Input
                id="entity-traits"
                value={traits}
                onChange={(e) => setTraits(e.target.value)}
                placeholder="curious, witty"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="entity-description">Description</Label>
              <Textarea
                id="entity-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create entity</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entities.data?.map((entity) => (
          <Card key={entity._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{entity.name}</CardTitle>
                  <CardDescription>{entity.kind}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeEntity({ entityId: entity._id })}
                >
                  Delete
                </Button>
              </div>
            </CardHeader>
            {entity.description || entity.traits?.length ? (
              <CardContent className="space-y-2">
                {entity.description ? (
                  <p className="text-sm text-zinc-400">{entity.description}</p>
                ) : null}
                {entity.traits?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {entity.traits.map((trait) => (
                      <span
                        key={trait}
                        className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        ))}
        {entities.data?.length === 0 ? (
          <p className="text-sm text-zinc-500">No entities yet.</p>
        ) : null}
      </div>
    </section>
  )
}
