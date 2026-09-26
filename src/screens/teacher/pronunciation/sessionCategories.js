// A picture of a real category member reads faster for a child than an
// abstract glyph. Daily Actions has no illustrated icon set yet, so it keeps
// its Ionicon — the card renders whichever of the two is present.
const CATEGORY_ICON_IMAGES = {
  animals: require("../../../../assets/pronunciation-category-icons/animals.png"),
  classroom: require("../../../../assets/pronunciation-category-icons/classroom.png"),
  fruits: require("../../../../assets/pronunciation-category-icons/fruits.png"),
};

export function getCategoryIconImage(categoryId) {
  return CATEGORY_ICON_IMAGES[categoryId] || null;
}

export const SESSION_CATEGORIES = [
  {
    id: "animals",
    iconImage: CATEGORY_ICON_IMAGES.animals,
    title: "Animals",
    subtitle: "Common animal sounds and words",
    icon: "paw-outline",
    panelColor: "#DCEEFE",
  },
  {
    id: "classroom",
    iconImage: CATEGORY_ICON_IMAGES.classroom,
    title: "Classroom",
    subtitle: "Objects found in school",
    icon: "school-outline",
    panelColor: "#DFF3E2",
  },
  {
    id: "fruits",
    iconImage: CATEGORY_ICON_IMAGES.fruits,
    title: "Fruits",
    subtitle: "Everyday fruit vocabulary",
    icon: "nutrition-outline",
    panelColor: "#FCEFCF",
  },
  {
    id: "daily-actions",
    title: "Daily Actions",
    subtitle: "Common verbs and actions",
    icon: "walk-outline",
    panelColor: "#FDE3DF",
  },
];
