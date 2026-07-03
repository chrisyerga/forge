import type { Recipe } from '../recipe'
import { seoArticleRecipe } from './seoArticle'

const registry = new Map<string, Recipe>([[seoArticleRecipe.name, seoArticleRecipe]])

export function getRecipe(name: string): Recipe | undefined {
  return registry.get(name)
}

export function listRecipes(): Array<Recipe> {
  return [...registry.values()]
}
