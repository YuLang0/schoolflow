import { favoriteMatch } from '../lib/favorites';
import { ALLERGENS, type Meal } from '../lib/neis';

/** 한 끼 급식. 내 알레르기 재료가 든 메뉴는 ⚠ 표시 */
export function MealCard({ meal, allergies, showNumbers, favorites = [] }: { meal: Meal; allergies: number[]; showNumbers: boolean; favorites?: string[] }) {
  return (
    <div className="meal">
      <div className="meal-head">
        <span className="badge">{meal.type}</span>
        {meal.calories && <small className="muted">{meal.calories}</small>}
      </div>
      <ul className="dishes">
        {meal.dishes.map((d, i) => {
          const hit = d.allergens.filter((n) => allergies.includes(n));
          const fav = favoriteMatch(d.name, favorites);
          return (
            <li key={i} className={hit.length ? 'allergic' : fav ? 'fav' : ''} title={hit.length ? `주의: ${hit.map((n) => ALLERGENS[n - 1]).join(', ')}` : undefined}>
              {hit.length > 0 && <span aria-label={`알레르기 주의: ${hit.map((n) => ALLERGENS[n - 1]).join(', ')}`}>⚠ </span>}
              {fav && !hit.length && <span aria-label="좋아하는 메뉴">⭐ </span>}
              {d.name}
              {showNumbers && d.allergens.length > 0 && <small className="muted"> ({d.allergens.join('.')})</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
