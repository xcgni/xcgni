import type { PageServerLoad } from './$types';
import { pg } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  // list decks (with card counts) so the user can pick interests to learn from
  const decks = await pg`
    SELECT deck, deck_label, count(*)::int AS cards
    FROM retention_cards WHERE active
    GROUP BY deck, deck_label
    ORDER BY deck_label
  `;
  return {
    decks: decks.map((d: { deck: string; deck_label: string; cards: number }) => ({
      slug: d.deck, label: d.deck_label, cards: d.cards
    }))
  };
};
