import type { Meal } from './neis';

/** 메뉴 이름에 좋아하는 단어가 들어 있으면 그 단어 */
export function favoriteMatch(dish: string, favorites: string[]): string | null {
  const name = dish.replace(/\s/g, '');
  return favorites.find((f) => f && name.includes(f.replace(/\s/g, ''))) ?? null;
}

/** 이 끼니에 나오는 좋아하는 메뉴 이름들 */
export function favoriteDishes(meal: Meal, favorites: string[]): string[] {
  return meal.dishes.filter((d) => favoriteMatch(d.name, favorites)).map((d) => d.name);
}
