/**
 * Picture style for the word images the child sees.
 *
 * Photos are the default because a real photo is what the word actually looks
 * like in the world. Some children — especially those who find busy photos
 * hard to parse — read a clean cartoon far faster, so the teacher can switch
 * the whole session to cartoons on the setup screen.
 *
 * The cartoon set only covers part of the word bank; any word without one
 * falls back to its photo, so switching style never leaves an empty card.
 */
export const IMAGE_STYLES = {
  REAL: "real",
  CARTOON: "cartoon",
};

export const DEFAULT_IMAGE_STYLE = IMAGE_STYLES.REAL;

export const WORD_CARTOON_IMAGES = {
  // Animals
  ant: require("../../../../assets/pronunciation-cartoon-images/ant.png"),
  butterfly: require("../../../../assets/pronunciation-cartoon-images/butterfly.png"),
  cat: require("../../../../assets/pronunciation-cartoon-images/cat.png"),
  cow: require("../../../../assets/pronunciation-cartoon-images/cow.png"),
  dog: require("../../../../assets/pronunciation-cartoon-images/dog.png"),
  elephant: require("../../../../assets/pronunciation-cartoon-images/elephant.png"),
  horse: require("../../../../assets/pronunciation-cartoon-images/horse.png"),
  tiger: require("../../../../assets/pronunciation-cartoon-images/tiger.png"),

  // Classroom
  bag: require("../../../../assets/pronunciation-cartoon-images/bag.png"),
  book: require("../../../../assets/pronunciation-cartoon-images/book.png"),
  chair: require("../../../../assets/pronunciation-cartoon-images/chair.png"),
  desk: require("../../../../assets/pronunciation-cartoon-images/desk.png"),
  pencil: require("../../../../assets/pronunciation-cartoon-images/pencil.png"),
  ruler: require("../../../../assets/pronunciation-cartoon-images/ruler.png"),

  // Fruits
  apple: require("../../../../assets/pronunciation-cartoon-images/apple.png"),
  banana: require("../../../../assets/pronunciation-cartoon-images/banana.png"),
  grape: require("../../../../assets/pronunciation-cartoon-images/grape.png"),
  guava: require("../../../../assets/pronunciation-cartoon-images/guava.png"),
  mango: require("../../../../assets/pronunciation-cartoon-images/mango.png"),
  orange: require("../../../../assets/pronunciation-cartoon-images/orange.png"),
  papaya: require("../../../../assets/pronunciation-cartoon-images/papaya.png"),
};

export function getCartoonImageSource(word) {
  return WORD_CARTOON_IMAGES[word?.id] || null;
}
