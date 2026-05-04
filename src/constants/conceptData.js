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
        real:     require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Cherry/Cherry_IO.jpg'),
        animated: require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Animated.png'),
      },
      {
        key:      'grapes',
        label:    'Grapes',
        labelSi:  'මිදි',
        plural:   true,
        real:     require('../../assets/concepts/categories/Fruits/Grapes/Grapes_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Grapes/Grapes_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Grapes/Grapes_Animated.png'),
      },
      {
        key:      'guava',
        label:    'Guava',
        labelSi:  'පේර',
        real:     require('../../assets/concepts/categories/Fruits/Guava/Guava_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Guava/Guava_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Guava/Guava_Animated.png'),
      },
      {
        key:      'mango',
        label:    'Mango',
        labelSi:  'අඹ',
        real:     require('../../assets/concepts/categories/Fruits/Mango/Mango_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Mango/Mango_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Mango/Mango_Animated.png'),
      },
      {
        key:      'orange',
        label:    'Orange',
        labelSi:  'දොඩම්',
        real:     require('../../assets/concepts/categories/Fruits/Orange/Orange_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Orange/Orange_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Orange/Orange_Animated.png'),
      },
      {
        key:      'papaya',
        label:    'Papaya',
        labelSi:  'පැපොල්',
        real:     require('../../assets/concepts/categories/Fruits/Papaya/Papaya_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Papaya/Papaya_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Papaya/Papaya_Animated.png'),
      },
      {
        key:      'passion',
        label:    'Passion Fruit',
        labelSi:  'පැෂන් ෆ්‍රූට්',
        real:     require('../../assets/concepts/categories/Fruits/Passion/Passion_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Passion/Passion_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Passion/Passion_Animated.png'),
      },
      {
        key:      'pineapple',
        label:    'Pineapple',
        labelSi:  'අනන්නාස්',
        real:     require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Pineapple/Pineapple_Animated.png'),
      },
      {
        key:      'watermelon',
        label:    'Watermelon',
        labelSi:  'කොමඩු',
        real:     require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Watermelon/Watermelon_Animated.png'),
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
