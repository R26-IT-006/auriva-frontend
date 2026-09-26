/**
 * @typedef {'Megatron' | 'Lily' | 'Glitter' | 'Boba'} AvatarName
 */

/**
 * @typedef {Object} Theme
 * @property {AvatarName} name
 * @property {string} background
 * @property {string} cardSurface
 * @property {string} cardOutline
 * @property {string} primaryButton
 * @property {string} buttonText
 * @property {string} headingText
 */

/** @type {Theme[]} */
export const THEMES = [
  {
    name: 'Megatron',
    background: '#F7FBFF',
    cardSurface: '#FFFFFF',
    cardOutline: '#85B7EB',
    primaryButton: '#302E91',
    buttonText: '#FFFFFF',
    headingText: '#3D2C2C',
  },
  {
    name: 'Lily',
    background: '#F5FFFA',
    cardSurface: '#FFFFFF',
    cardOutline: '#5DCAA5',
    primaryButton: '#3D7A6E',
    buttonText: '#FFFFFF',
    headingText: '#1A3040',
  },
  {
    name: 'Glitter',
    background: '#F9FAFE',
    cardSurface: '#FFFFFF',
    cardOutline: '#AFA9EC',
    primaryButton: '#7F77DD',
    buttonText: '#FFFFFF',
    headingText: '#2A2018',
  },
  {
    name: 'Boba',
    background: '#FFFDFA',
    cardSurface: '#FFFFFF',
    cardOutline: '#EF9F27',
    primaryButton: '#97483B',
    buttonText: '#FFFFFF',
    headingText: '#1A2B30',
  },
];

/** @param {AvatarName} name @returns {Theme} */
export const getTheme = (name) => {
  return THEMES.find(t => t.name === name) || THEMES[0];
};
