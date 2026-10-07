/**
 * dialogueFlow.js
 *
 * What happens in the Dialogue module, as data — rendered by the shared
 * FlowOverviewModal ("How it works") on DialogueLandingScreen, where the child
 * chooses Level 1 or Level 2. Traced from the screens:
 *
 *   Level 1  DialogueCategory → Level1Overview → Magic Words / Greetings /
 *            "Can you…" landing (MagicWordLanding, GreetingLanding, AbilityLanding;
 *            a ProbeProduction check is offered there for an earlier word)
 *     Phase 1  Phase1Video (videos) → AnimatedWord → BoldWord → DragToLine
 *              (3 drag-the-phrase activities; a mistake on the last one →
 *              rewatch the videos once) → Phase1Complete
 *     Phase 2  Phase2Production: hear the word, record it; a partly-right try
 *              → letter-sound highlight + slow audio, then "say it with me";
 *              no response after prompts → Phase2NonVerbal
 *     Phase 3  Phase3Contextual: picture scenarios A, B (C / checkpoint
 *              depending on answers); all wrong → rewatch once → WordComplete
 *            WordComplete: "Good job" / "Congratulations" (mastered) → next word
 *   Level 2  L2TopicSelection (+ questionnaire / friend / pet details) →
 *            L2Loading → L2Contrastive → L2SentencePath (5 sentence stops +
 *            practice) → L2SentenceTeach steps 1–4 → L2ListenTogether →
 *            L2Production → L2SessionComplete
 *
 * Pure data; if the flow in the screens changes, change it here too.
 */

export const PHASE1_DRAG_ACTIVITIES = 3;   // DragToLineScreen ACTIVITIES: 3 per word
export const L2_SENTENCES = 5;             // L2SessionCompleteScreen: "all 5 sentences"

export function buildDialogueFlow() {
  return [
    {
      key: 'choose',
      kind: 'start',
      icon: 'layers',
      title: 'Choose a level',
      subtitle: 'This screen',
      childDoes: 'Level 1 teaches single social words and phrases. Level 2 builds short sentences about a topic.',
    },
    {
      key: 'l1-category',
      kind: 'start',
      icon: 'grid',
      tag: 'Level 1',
      title: 'Pick a category and a word',
      subtitle: 'Magic Words, Greetings, or "Can you…?"',
      childDoes: 'Opens a category; the next word to learn is shown. A quick check on an earlier word may be offered here too.',
    },
    {
      key: 'phase1',
      kind: 'tier',
      tag: 'Phase 1',
      icon: 'play-circle',
      title: 'Watch & recognise',
      subtitle: 'Learn what the word means',
      steps: ['Watch the videos', 'See the word', `Drag the phrase (×${PHASE1_DRAG_ACTIVITIES})`],
      childDoes: `Watches short videos of the word being used, sees the word, then drags the right phrase into the sentence in ${PHASE1_DRAG_ACTIVITIES} small activities.`,
      ifWrong: 'Shakes back to try again. A mistake on the final activity means watching the videos once more.',
    },
    {
      key: 'phase2',
      kind: 'tier',
      tag: 'Phase 2',
      icon: 'mic',
      title: 'Say it',
      subtitle: 'Speak the word aloud',
      steps: ['Hear the word', 'Record', 'Feedback'],
      childDoes: 'Hears the word twice, then taps Record and says it. Tapping the word card plays it again.',
      ifWrong: 'A partly-right try gets the key sound highlighted and the word played slowly, then "Say it with me!". If the child does not respond after a few prompts, they move to a non-verbal way of answering instead.',
    },
    {
      key: 'phase3',
      kind: 'tier',
      tag: 'Phase 3',
      icon: 'images',
      title: 'Use it',
      subtitle: 'When do we say it?',
      steps: ['Scenario A', 'Scenario B', 'More if needed'],
      childDoes: 'Looks at picture scenarios and chooses the one where the word fits, then confirms.',
      ifWrong: 'Depending on the answers, an extra scenario or a checkpoint is added. If every answer is wrong, the child watches the videos once more.',
    },
    {
      key: 'word-done',
      kind: 'milestone',
      icon: 'star',
      title: 'Word complete',
      subtitle: '"Good job!" or "Congratulations!" when mastered',
      childDoes: 'Can try the word again or go on to the next word in the category.',
    },
    {
      key: 'level2',
      kind: 'tier',
      tag: 'Level 2',
      icon: 'chatbubbles',
      title: 'Build sentences',
      subtitle: 'Self-introduction, a friend, a pet, or draw yourself',
      steps: ['Choose a topic', `Sentence path (${L2_SENTENCES} stops)`, 'Listen, build & say', 'Practise the paragraph'],
      childDoes: `Answers a few questions about themselves (or a friend / pet), sees how English word order differs from Sinhala, then learns ${L2_SENTENCES} sentences one at a time: listen, drag the missing word, build the sentence and say it. Finally listens to and says the whole paragraph.`,
      ifWrong: 'Wrong words shake and go back to the word bank to try again; a hint highlights the right card.',
    },
    {
      key: 'level2-done',
      kind: 'milestone',
      icon: 'trophy',
      title: 'Session complete',
      subtitle: 'A recap of the sentences learnt today',
      childDoes: 'Celebrates and returns to the topics to choose another one.',
    },
  ];
}
