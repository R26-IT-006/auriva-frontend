import { MIN_PAIRS } from './conceptPairMatch';

/**
 * conceptFlow.js
 *
 * What happens after a child taps a concept, as data — rendered by
 * components/concept/ConceptFlowModal.js ("How it works") so a teacher can see
 * the module's flow at a glance. Traced from the screens themselves:
 *
 *   ConceptItemsScreen.routeForItem   resumes at the first unfinished tier
 *   tier1/  ConceptImage → ConceptDemo → ConceptMatch
 *           wrong → ConceptImage (relearn) → ConceptAdaptiveQuiz
 *   tier2/  Tier2Image → Tier2Demo → Tier2Activity
 *           wrong → Tier2DragDrop → Tier2Image (relearn)
 *   tier3/  Tier3Video → ConceptColoring   (only where categoryHasVideo)
 *   mastery = tier 1 + tier 2 passed (backend conceptService isMastered)
 *   category activities unlock from ConceptItemsScreen's activity list
 *
 * Pure: the catalogue facts it needs are passed in, so it can be tested
 * without loading the asset-heavy catalogue. If the flow in the screens
 * changes, change it here too.
 */

/**
 * @param {Array<{key:string,label:string,items:Array}>} categories  e.g. getOrderedCategories()
 * @param {(categoryKey:string) => boolean} hasVideo                  e.g. categoryHasVideo
 */
export function buildConceptFlow(categories = [], hasVideo = () => true) {
  const noVideo = categories
    .filter((c) => c.items?.length > 0 && !hasVideo(c.key))
    .map((c) => c.label);

  return [
    {
      key: 'choose',
      kind: 'start',
      icon: 'grid',
      title: 'Choose a concept',
      subtitle: 'Pick a category, then a concept',
      childDoes: 'Taps a picture card. The app opens the concept at the stage the child reached last time.',
    },
    {
      key: 'tier1',
      kind: 'tier',
      tier: 1,
      icon: 'search',
      title: 'Find it',
      subtitle: 'Tier 1 · Recognise the picture',
      steps: ['See & hear it', 'Watch a demo', 'Find it among pictures'],
      childDoes: 'Looks at the photo and hears "This is a …", watches a quick demo, then taps the right picture.',
      ifWrong: 'Sees the concept again, then gets an easier choice between it and the one they mixed it up with.',
    },
    {
      key: 'tier2',
      kind: 'tier',
      tier: 2,
      icon: 'chatbubble-ellipses',
      title: 'Name it',
      subtitle: 'Tier 2 · Match the name to the picture',
      steps: ['See & hear it', 'Watch a demo', 'Choose the right name'],
      childDoes: 'Hears the name again, watches a demo, then chooses the correct name for the picture.',
      ifWrong: 'Gets a supported drag-the-name activity, then looks at the concept again before retrying.',
    },
    {
      key: 'tier3',
      kind: 'tier',
      tier: 3,
      icon: 'videocam',
      title: 'Watch & colour',
      subtitle: 'Tier 3 · Enjoy and explore (not scored)',
      steps: ['Watch a short video', 'Colour the picture'],
      childDoes: 'Watches a short video about the concept, then colours it in.',
      note: noVideo.length ? `Skipped for ${noVideo.join(', ')}.` : null,
    },
    {
      key: 'mastered',
      kind: 'milestone',
      icon: 'star',
      title: 'Concept learnt',
      subtitle: 'Found it (Tier 1) + Named it (Tier 2)',
      childDoes: 'A concept counts as learnt once both Tier 1 and Tier 2 are passed. The video stage is not scored.',
    },
    {
      key: 'games',
      kind: 'milestone',
      icon: 'game-controller',
      title: 'Category games unlock',
      subtitle: 'Practise what has been learnt',
      childDoes: `Review activity opens after 1 concept is learnt. Photo ↔ Picture Match and Memory open after ${MIN_PAIRS}.`,
    },
    {
      key: 'badge',
      kind: 'milestone',
      icon: 'trophy',
      title: 'Earn the category badge',
      subtitle: 'Every concept in the category learnt',
      childDoes: 'The badge shows as earned in the Progress pop-up.',
    },
  ];
}
