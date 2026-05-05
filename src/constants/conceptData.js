// Static concept catalogue — mirrors backend CATEGORY_SEQUENCES order
export const CONCEPT_CATEGORIES = {
  fruits: {
    key:   'fruits',
    label: 'Fruits',
    items: [
      {
        key:         'apple',
        label:       'Apple',
        labelSi:     'ඇපල්',
        icon:        require('../../assets/concepts/categories/Fruits/Fruits_Icons/apple.png'),
        real:        require('../../assets/concepts/categories/Fruits/Apple/Apple_Real.png'),
        io:          require('../../assets/concepts/categories/Fruits/Apple/Apple_IO.png'),
        animated:    require('../../assets/concepts/categories/Fruits/Apple/Apple_Animated.png'),
        introAudio:  require('../../assets/concepts/audio/Fruits/Apple/AppleIntro.m4a'),
        t1Audio:     require('../../assets/concepts/audio/Fruits/Apple/AppleT1Qestion.m4a'),
      },
      {
        key:        'banana',
        label:      'Bananas',
        labelSi:    'කෙසෙල්',
        plural:     true,
        icon:       require('../../assets/concepts/categories/Fruits/Fruits_Icons/banana.png'),
        real:       require('../../assets/concepts/categories/Fruits/Banana/Banana_Real.png'),
        io:         require('../../assets/concepts/categories/Fruits/Banana/Banana_IO.png'),
        animated:   require('../../assets/concepts/categories/Fruits/Banana/Banana_Animated.png'),
        introAudio: require('../../assets/concepts/audio/Fruits/Banana/BananaIntro.m4a'),
        t1Audio:    require('../../assets/concepts/audio/Fruits/Banana/BananaT1Question.m4a'),
      },
      {
        key:      'cherry',
        label:    'Cherries',
        labelSi:  'චෙරි',
        plural:   true,
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/cherries.png'),
        real:     require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Cherry/Cherry_IO.jpg'),
        animated: require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Animated.png'),
      },
      {
        key:      'grapes',
        label:    'Grapes',
        labelSi:  'මිදි',
        plural:   true,
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/grape.png'),
        real:     require('../../assets/concepts/categories/Fruits/Grapes/Grapes_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Grapes/Grapes_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Grapes/Grapes_Animated.png'),
      },
      {
        key:      'guava',
        label:    'Guava',
        labelSi:  'පේර',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/guava.png'),
        real:     require('../../assets/concepts/categories/Fruits/Guava/Guava_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Guava/Guava_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Guava/Guava_Animated.png'),
      },
      {
        key:      'mango',
        label:    'Mango',
        labelSi:  'අඹ',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/mango.png'),
        real:     require('../../assets/concepts/categories/Fruits/Mango/Mango_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Mango/Mango_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Mango/Mango_Animated.png'),
      },
      {
        key:      'orange',
        label:    'Orange',
        labelSi:  'දොඩම්',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/orange.png'),
        real:     require('../../assets/concepts/categories/Fruits/Orange/Orange_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Orange/Orange_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Orange/Orange_Animated.png'),
      },
      {
        key:      'papaya',
        label:    'Papaya',
        labelSi:  'පැපොල්',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/papaya.png'),
        real:     require('../../assets/concepts/categories/Fruits/Papaya/Papaya_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Papaya/Papaya_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Papaya/Papaya_Animated.png'),
      },
      {
        key:      'passion',
        label:    'Passion Fruit',
        labelSi:  'පැෂන් ෆ්‍රූට්',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/passion.png'),
        real:     require('../../assets/concepts/categories/Fruits/Passion/Passion_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Passion/Passion_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Passion/Passion_Animated.png'),
      },
      {
        key:      'pineapple',
        label:    'Pineapple',
        labelSi:  'අනන්නාස්',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/pineapple.png'),
        real:     require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_Animated.png'),
      },
      {
        key:      'watermelon',
        label:    'Watermelon',
        labelSi:  'කොමඩු',
        icon:     require('../../assets/concepts/categories/Fruits/Fruits_Icons/watermelon.png'),
        real:     require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_Animated.png'),
      },
    ],
  },
  classroom: {
    key:   'classroom',
    label: 'Classroom Objects',
    items: [
      {
        key:      'bag',
        label:    'Bag',
        labelSi:  'බෑගය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/bag.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Bag/Bag_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Bag/Bag_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Bag/Bag_Animated.png'),
      },
      {
        key:      'blackboard',
        label:    'Blackboard',
        labelSi:  'කළු පුවරුව',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/blackboard.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Blackboard/Blackboard_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Blackboard/Blackboard_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Blackboard/Blackboard_Animated.png'),
      },
      {
        key:      'book',
        label:    'Book',
        labelSi:  'පොත',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/book.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Book/Book_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Book/Book_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Book/Book_Animated.png'),
      },
      {
        key:      'bottle',
        label:    'Bottle',
        labelSi:  'බෝතලය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/bottle.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Bottle/Bottle_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Bottle/Bottle_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Bottle/Bottle_Animated.png'),
      },
      {
        key:      'chair',
        label:    'Chair',
        labelSi:  'පුටුව',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/chair.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Chair/Chair_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Chair/Chair__Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Chair/Chair_Animated.png'),
      },
      {
        key:      'desk',
        label:    'Desk',
        labelSi:  'ඩෙස්කය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/desk.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Desk/Desk_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Desk/Desk_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Desk/Desk_Animated.png'),
      },
      {
        key:      'dustbin',
        label:    'Dustbin',
        labelSi:  'කුණු බකට',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/dustbin.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Dustbin/Dustbin_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Dustbin/Dustbin_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Dustbin/Dustbin_Animated.png'),
      },
      {
        key:      'eraser',
        label:    'Eraser',
        labelSi:  'ඉරේසරය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/eraser.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Eraser/Eraser_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Eraser/Eraser_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Eraser/Eraser_Animated.png'),
      },
      {
        key:      'pencil',
        label:    'Pencil',
        labelSi:  'පැන්සල',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/pencil.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Pencil/Pencil_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Pencil/Pencil_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Pencil/Pencil_Animated.png'),
      },
      {
        key:      'ruler',
        label:    'Ruler',
        labelSi:  'රූලරය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/ruler.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Ruler/Ruler_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Ruler/Ruler_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Ruler/Ruler_Animated.png'),
      },
      {
        key:      'table',
        label:    'Table',
        labelSi:  'මේසය',
        icon:     require('../../assets/concepts/categories/Classroom Objects/Classroom_Icons/table.png'),
        real:     require('../../assets/concepts/categories/Classroom Objects/Table/Table_Real.png'),
        io:       require('../../assets/concepts/categories/Classroom Objects/Table/Table_Coloring.png'),
        animated: require('../../assets/concepts/categories/Classroom Objects/Table/Table_Animated.png'),
      },
    ],
  },
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export function getConceptPhrase(concept) {
  if (!concept) return '';
  if (concept.plural) return `These are ${concept.label}`;
  const article = VOWELS.has(concept.label[0].toLowerCase()) ? 'an' : 'a';
  return `This is ${article} ${concept.label}`;
}

export function getConceptQuestion(concept) {
  if (!concept) return '';
  if (concept.plural) return `Can you find ${concept.label} here?`;
  const article = VOWELS.has(concept.label[0].toLowerCase()) ? 'an' : 'a';
  return `Can you find ${article} ${concept.label} here?`;
}

// Sinhala has no articles — structure is the same for singular and plural
export function getConceptQuestionSi(concept) {
  if (!concept?.labelSi) return '';
  return `ඔයාට ${concept.labelSi} හොයාගන්න පුළුවන්ද?`;
}

export function getConceptItem(categoryKey, conceptKey) {
  const cat = CONCEPT_CATEGORIES[categoryKey];
  if (!cat) return null;
  return cat.items.find((it) => it.key === conceptKey) || null;
}

export function getConceptItemsForCategory(categoryKey) {
  return CONCEPT_CATEGORIES[categoryKey]?.items ?? [];
}
