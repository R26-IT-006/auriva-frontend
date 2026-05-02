// Static concept catalogue — mirrors backend CATEGORY_SEQUENCES order
export const CONCEPT_CATEGORIES = {
  fruits: {
    key:   'fruits',
    label: 'Fruits',
    items: [
      {
        key:      'apple',
        label:    'Apple',
        labelSi:  'ඇපල්',
        real:     require('../../assets/concepts/categories/Fruits/Apple/Apple_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Apple/Apple_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Apple/Apple_Animated.png'),
      },
      {
        key:      'banana',
        label:    'Banana',
        labelSi:  'කෙසෙල්',
        real:     require('../../assets/concepts/categories/Fruits/Banana/Banana_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Banana/Banana_IO.png'),
        animated: require('../../assets/concepts/categories/Fruits/Banana/Banana_Animated.png'),
      },
      {
        key:      'cherry',
        label:    'Cherry',
        labelSi:  'චෙරි',
        real:     require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Real.png'),
        io:       require('../../assets/concepts/categories/Fruits/Cherry/Cherry_IO.jpg'),
        animated: require('../../assets/concepts/categories/Fruits/Cherry/Cherry_Animated.png'),
      },
      {
        key:      'grapes',
        label:    'Grapes',
        labelSi:  'මිදි',
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

export function getConceptItem(categoryKey, conceptKey) {
  const cat = CONCEPT_CATEGORIES[categoryKey];
  if (!cat) return null;
  return cat.items.find((it) => it.key === conceptKey) || null;
}

export function getConceptItemsForCategory(categoryKey) {
  return CONCEPT_CATEGORIES[categoryKey]?.items ?? [];
}
