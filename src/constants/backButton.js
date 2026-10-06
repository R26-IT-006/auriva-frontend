/**
 * backButton.js
 *
 * The single look for the back button across the student workspace (concept,
 * handwriting, dialogue, pronunciation): Concept's round translucent header
 * button — 40pt circle, white at 70%, soft shadow — holding a 20pt arrow-back
 * in the theme's heading colour.
 *
 * Screens append BACK_BUTTON last in their back button's style array, so it
 * wins on size / fill / border while the screen keeps its own positioning
 * (absolute placement, margins). What the button does stays with the screen.
 */
export const BACK_ICON_SIZE = 20;

export const BACK_BUTTON = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.7)',
  borderWidth: 0,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 2,
};
