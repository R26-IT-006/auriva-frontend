/**
 * Visual reward assets for the result screen.
 *
 * The congratulations picture is the child's own avatar, so praise comes
 * from the character they chose rather than a generic badge. The two
 * animated stamps are motion, so callers gate them on the student's
 * "reduce celebration effects" setting the same way confetti is gated.
 */
const AVATAR_CONGRATULATIONS_IMAGES = {
  boba: require("../../../../assets/new_images/BobaCongratulations.png"),
  glitter: require("../../../../assets/new_images/GlitterCongratulations.png"),
  lily: require("../../../../assets/new_images/LilyCongratulations.png"),
  megatron: require("../../../../assets/new_images/MegatronCongratulations.png"),
};

export const CORRECT_STAMP_GIF = require("../../../../assets/avatar-videos/correct.gif");
export const WRONG_STAMP_GIF = require("../../../../assets/avatar-videos/wrong.gif");

export function getCongratulationsImage(avatarKey) {
  return AVATAR_CONGRATULATIONS_IMAGES[avatarKey] || null;
}
