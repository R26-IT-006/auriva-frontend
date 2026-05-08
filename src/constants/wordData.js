// Word list sourced from the project's collected word-image set.
// Sorted within each letter group by word length so the screen's
// length-group sequencing (3 → 4 → 5+) works by simply sorting on word.length.

const WORD_DATA = [
  // ── A ─────────────────────────────────────────────────────────────────────
  { word: 'ant',       letter: 'a', emoji: '🐜', imageKey: 'ant'       },
  { word: 'axe',       letter: 'a', emoji: '🪓', imageKey: 'axe'       },
  { word: 'album',     letter: 'a', emoji: '📸', imageKey: 'album'     },
  { word: 'apple',     letter: 'a', emoji: '🍎', imageKey: 'apple'     },
  { word: 'arrow',     letter: 'a', emoji: '🏹', imageKey: 'arrow'     },

  // ── B ─────────────────────────────────────────────────────────────────────
  { word: 'box',       letter: 'b', emoji: '📦', imageKey: 'box'       },
  { word: 'bee',       letter: 'b', emoji: '🐝', imageKey: 'bee'       },
  { word: 'bun',       letter: 'b', emoji: '🧁', imageKey: 'bun'       },
  { word: 'bus',       letter: 'b', emoji: '🚌', imageKey: 'bus'       },
  { word: 'bell',      letter: 'b', emoji: '🔔', imageKey: 'bell'      },
  { word: 'book',      letter: 'b', emoji: '📚', imageKey: 'book'      },
  { word: 'ball',      letter: 'b', emoji: '⚽', imageKey: 'ball'      },
  { word: 'butterfly', letter: 'b', emoji: '🦋', imageKey: 'butterfly' },
  { word: 'banana',    letter: 'b', emoji: '🍌', imageKey: 'banana'    },
  { word: 'balloon',   letter: 'b', emoji: '🎈', imageKey: 'balloon'   },

  // ── C ─────────────────────────────────────────────────────────────────────
  { word: 'cat',       letter: 'c', emoji: '🐱', imageKey: 'cat'       },
  { word: 'cup',       letter: 'c', emoji: '☕', imageKey: 'cup'       },
  { word: 'cap',       letter: 'c', emoji: '🧢', imageKey: 'cap'       },
  { word: 'car',       letter: 'c', emoji: '🚗', imageKey: 'car'       },
  { word: 'cow',       letter: 'c', emoji: '🐄', imageKey: 'cow'       },
  { word: 'cake',      letter: 'c', emoji: '🎂', imageKey: 'cake'      },
  { word: 'computer',  letter: 'c', emoji: '💻', imageKey: 'computer'  },
  { word: 'camera',    letter: 'c', emoji: '📷', imageKey: 'camera'    },
  { word: 'calendar',  letter: 'c', emoji: '📅', imageKey: 'calendar'  },

  // ── D ─────────────────────────────────────────────────────────────────────
  { word: 'dog',       letter: 'd', emoji: '🐶', imageKey: 'dog'       },
  { word: 'duck',      letter: 'd', emoji: '🦆', imageKey: 'duck'      },
  { word: 'drum',      letter: 'd', emoji: '🥁', imageKey: 'drum'      },
  { word: 'door',      letter: 'd', emoji: '🚪', imageKey: 'door'      },
  { word: 'deer',      letter: 'd', emoji: '🦌', imageKey: 'deer'      },
  { word: 'desk',      letter: 'd', emoji: '🗂️', imageKey: 'desk'      },

  // ── E ─────────────────────────────────────────────────────────────────────
  { word: 'egg',       letter: 'e', emoji: '🥚', imageKey: 'egg'       },
  { word: 'elf',       letter: 'e', emoji: '🧝', imageKey: 'elf'       },
  { word: 'eight',     letter: 'e', emoji: '8️⃣', imageKey: 'eight'     },
  { word: 'engine',    letter: 'e', emoji: '🚂', imageKey: 'engine'    },
  { word: 'elephant',  letter: 'e', emoji: '🐘', imageKey: 'elephant'  },

  // ── F ─────────────────────────────────────────────────────────────────────
  { word: 'fan',       letter: 'f', emoji: '🪭', imageKey: 'fan'       },
  { word: 'fox',       letter: 'f', emoji: '🦊', imageKey: 'fox'       },
  { word: 'fog',       letter: 'f', emoji: '🌫️', imageKey: 'fog'       },
  { word: 'fish',      letter: 'f', emoji: '🐠', imageKey: 'fish'      },
  { word: 'fork',      letter: 'f', emoji: '🍴', imageKey: 'fork'      },
  { word: 'fire',      letter: 'f', emoji: '🔥', imageKey: 'fire'      },
  { word: 'flag',      letter: 'f', emoji: '🚩', imageKey: 'flag'      },
  { word: 'four',      letter: 'f', emoji: '4️⃣', imageKey: 'four'      },
  { word: 'five',      letter: 'f', emoji: '5️⃣', imageKey: 'five'      },
  { word: 'flower',    letter: 'f', emoji: '🌸', imageKey: 'flower'    },

  // ── G ─────────────────────────────────────────────────────────────────────
  { word: 'goat',      letter: 'g', emoji: '🐐', imageKey: 'goat'      },
  { word: 'gate',      letter: 'g', emoji: '🚧', imageKey: 'gate'      },
  { word: 'grass',     letter: 'g', emoji: '🌿', imageKey: 'grass'     },
  { word: 'grapes',    letter: 'g', emoji: '🍇', imageKey: 'grapes'    },
  { word: 'gloves',    letter: 'g', emoji: '🧤', imageKey: 'gloves'    },

  // ── H ─────────────────────────────────────────────────────────────────────
  { word: 'hat',       letter: 'h', emoji: '🎩', imageKey: 'hat'       },
  { word: 'hen',       letter: 'h', emoji: '🐔', imageKey: 'hen'       },
  { word: 'horse',     letter: 'h', emoji: '🐴', imageKey: 'horse'     },
  { word: 'house',     letter: 'h', emoji: '🏠', imageKey: 'house'     },
  { word: 'hammer',    letter: 'h', emoji: '🔨', imageKey: 'hammer'    },
  { word: 'helicopter',letter: 'h', emoji: '🚁', imageKey: 'helicopter'},

  // ── I ─────────────────────────────────────────────────────────────────────
  { word: 'ink',       letter: 'i', emoji: '✒️', imageKey: 'ink'       },
  { word: 'ice',       letter: 'i', emoji: '🧊', imageKey: 'ice'       },
  { word: 'iron',      letter: 'i', emoji: '🔩', imageKey: 'iron'      },
  { word: 'igloo',     letter: 'i', emoji: '❄️', imageKey: 'igloo'     },
  { word: 'ice cream', letter: 'i', emoji: '🍦', imageKey: 'icecream'  },

  // ── J ─────────────────────────────────────────────────────────────────────
  { word: 'jam',       letter: 'j', emoji: '🍓', imageKey: 'jam'       },
  { word: 'jug',       letter: 'j', emoji: '🏺', imageKey: 'jug'       },
  { word: 'jet',       letter: 'j', emoji: '✈️', imageKey: 'jet'       },
  { word: 'jeep',      letter: 'j', emoji: '🚙', imageKey: 'jeep'      },

  // ── K ─────────────────────────────────────────────────────────────────────
  { word: 'key',       letter: 'k', emoji: '🔑', imageKey: 'key'       },
  { word: 'kite',      letter: 'k', emoji: '🪁', imageKey: 'kite'      },
  { word: 'kiwi',      letter: 'k', emoji: '🥝', imageKey: 'kiwi'      },
  { word: 'king',      letter: 'k', emoji: '👑', imageKey: 'king'      },
  { word: 'kangaroo',  letter: 'k', emoji: '🦘', imageKey: 'kangaroo'  },
  { word: 'kettle',    letter: 'k', emoji: '🫖', imageKey: 'kettle'    },
  { word: 'kitten',    letter: 'k', emoji: '🐱', imageKey: 'kitten'    },

  // ── L ─────────────────────────────────────────────────────────────────────
  { word: 'log',       letter: 'l', emoji: '🪵', imageKey: 'log'       },
  { word: 'leg',       letter: 'l', emoji: '🦵', imageKey: 'leg'       },
  { word: 'lion',      letter: 'l', emoji: '🦁', imageKey: 'lion'      },
  { word: 'leaf',      letter: 'l', emoji: '🍃', imageKey: 'leaf'      },
  { word: 'lips',      letter: 'l', emoji: '👄', imageKey: 'lips'      },
  { word: 'lotus',     letter: 'l', emoji: '🌸', imageKey: 'lotus'     },
  { word: 'ladder',    letter: 'l', emoji: '🪜', imageKey: 'ladder'    },

  // ── M ─────────────────────────────────────────────────────────────────────
  { word: 'mug',       letter: 'm', emoji: '☕', imageKey: 'mug'       },
  { word: 'moon',      letter: 'm', emoji: '🌙', imageKey: 'moon'      },
  { word: 'mouse',     letter: 'm', emoji: '🐭', imageKey: 'mouse'     },
  { word: 'mango',     letter: 'm', emoji: '🥭', imageKey: 'mango'     },
  { word: 'monkey',    letter: 'm', emoji: '🐒', imageKey: 'monkey'    },

  // ── N ─────────────────────────────────────────────────────────────────────
  { word: 'net',       letter: 'n', emoji: '🥅', imageKey: 'net'       },
  { word: 'nail',      letter: 'n', emoji: '📌', imageKey: 'nail'      },
  { word: 'nest',      letter: 'n', emoji: '🪹', imageKey: 'nest'      },
  { word: 'nose',      letter: 'n', emoji: '👃', imageKey: 'nose'      },
  { word: 'nine',      letter: 'n', emoji: '9️⃣', imageKey: 'nine'      },
  { word: 'needle',    letter: 'n', emoji: '🪡', imageKey: 'needle'    },

  // ── O ─────────────────────────────────────────────────────────────────────
  { word: 'one',       letter: 'o', emoji: '1️⃣', imageKey: 'one'       },
  { word: 'owl',       letter: 'o', emoji: '🦉', imageKey: 'owl'       },
  { word: 'organ',     letter: 'o', emoji: '🎹', imageKey: 'organ'     },
  { word: 'otter',     letter: 'o', emoji: '🦦', imageKey: 'otter'     },
  { word: 'orange',    letter: 'o', emoji: '🍊', imageKey: 'orange'    },
  { word: 'ostrich',   letter: 'o', emoji: '🐦', imageKey: 'ostrich'   },

  // ── P ─────────────────────────────────────────────────────────────────────
  { word: 'pot',       letter: 'p', emoji: '🍲', imageKey: 'pot'       },
  { word: 'pen',       letter: 'p', emoji: '✏️', imageKey: 'pen'       },
  { word: 'parrot',    letter: 'p', emoji: '🦜', imageKey: 'parrot'    },
  { word: 'papaya',    letter: 'p', emoji: '🍊', imageKey: 'papaya'    },
  { word: 'penguin',   letter: 'p', emoji: '🐧', imageKey: 'penguin'   },
  { word: 'peacock',   letter: 'p', emoji: '🦚', imageKey: 'peacock'   },

  // ── Q ─────────────────────────────────────────────────────────────────────
  { word: 'quilt',     letter: 'q', emoji: '🛏️', imageKey: 'quilt'     },
  { word: 'quail',     letter: 'q', emoji: '🐦', imageKey: 'quail'     },
  { word: 'queen',     letter: 'q', emoji: '👑', imageKey: 'queen'     },
  { word: 'queue',     letter: 'q', emoji: '🚶', imageKey: 'queue'     },
  { word: 'quarter',   letter: 'q', emoji: '🪙', imageKey: 'quarter'   },

  // ── R ─────────────────────────────────────────────────────────────────────
  { word: 'rose',      letter: 'r', emoji: '🌹', imageKey: 'rose'      },
  { word: 'rake',      letter: 'r', emoji: '🌾', imageKey: 'rake'      },
  { word: 'river',     letter: 'r', emoji: '🏞️', imageKey: 'river'     },
  { word: 'rabbit',    letter: 'r', emoji: '🐰', imageKey: 'rabbit'    },
  { word: 'rainbow',   letter: 'r', emoji: '🌈', imageKey: 'rainbow'   },

  // ── S ─────────────────────────────────────────────────────────────────────
  { word: 'sun',       letter: 's', emoji: '☀️', imageKey: 'sun'       },
  { word: 'six',       letter: 's', emoji: '6️⃣', imageKey: 'six'       },
  { word: 'star',      letter: 's', emoji: '⭐', imageKey: 'star'      },
  { word: 'sand',      letter: 's', emoji: '🏖️', imageKey: 'sand'      },
  { word: 'sack',      letter: 's', emoji: '🎒', imageKey: 'sack'      },
  { word: 'snake',     letter: 's', emoji: '🐍', imageKey: 'snake'     },
  { word: 'snail',     letter: 's', emoji: '🐌', imageKey: 'snail'     },
  { word: 'skirt',     letter: 's', emoji: '👗', imageKey: 'skirt'     },
  { word: 'scarf',     letter: 's', emoji: '🧣', imageKey: 'scarf'     },
  { word: 'seven',     letter: 's', emoji: '7️⃣', imageKey: 'seven'     },

  // ── T ─────────────────────────────────────────────────────────────────────
  { word: 'two',       letter: 't', emoji: '2️⃣', imageKey: 'two'       },
  { word: 'ten',       letter: 't', emoji: '🔟', imageKey: 'ten'       },
  { word: 'tree',      letter: 't', emoji: '🌳', imageKey: 'tree'      },
  { word: 'train',     letter: 't', emoji: '🚂', imageKey: 'train'     },
  { word: 'three',     letter: 't', emoji: '3️⃣', imageKey: 'three'     },
  { word: 'toffee',    letter: 't', emoji: '🍬', imageKey: 'toffee'    },
  { word: 'tortoise',  letter: 't', emoji: '🐢', imageKey: 'tortoise'  },

  // ── U ─────────────────────────────────────────────────────────────────────
  { word: 'umpire',    letter: 'u', emoji: '⚖️', imageKey: 'umpire'    },
  { word: 'umbrella',  letter: 'u', emoji: '☂️', imageKey: 'umbrella'  },

  // ── V ─────────────────────────────────────────────────────────────────────
  { word: 'van',       letter: 'v', emoji: '🚐', imageKey: 'van'       },
  { word: 'vase',      letter: 'v', emoji: '🏺', imageKey: 'vase'      },
  { word: 'violin',    letter: 'v', emoji: '🎻', imageKey: 'violin'    },
  { word: 'volleyball',letter: 'v', emoji: '🏐', imageKey: 'volleyball'},
  { word: 'vegetables',letter: 'v', emoji: '🥦', imageKey: 'vegetables'},

  // ── W ─────────────────────────────────────────────────────────────────────
  { word: 'wolf',      letter: 'w', emoji: '🐺', imageKey: 'wolf'      },
  { word: 'wind',      letter: 'w', emoji: '💨', imageKey: 'wind'      },
  { word: 'well',      letter: 'w', emoji: '🪣', imageKey: 'well'      },
  { word: 'watch',     letter: 'w', emoji: '⌚', imageKey: 'watch'     },
  { word: 'watermelon',letter: 'w', emoji: '🍉', imageKey: 'watermelon'},

  // ── X ─────────────────────────────────────────────────────────────────────
  { word: 'x-ray',     letter: 'x', emoji: '🩻', imageKey: 'xray'      },
  { word: 'xylophone', letter: 'x', emoji: '🎵', imageKey: 'xylophone' },
  { word: 'x-mas tree',letter: 'x', emoji: '🎄', imageKey: 'xmastree'  },

  // ── Y ─────────────────────────────────────────────────────────────────────
  { word: 'yak',       letter: 'y', emoji: '🦬', imageKey: 'yak'       },
  { word: 'yarn',      letter: 'y', emoji: '🧶', imageKey: 'yarn'      },
  { word: 'yolk',      letter: 'y', emoji: '🍳', imageKey: 'yolk'      },
  { word: 'yo-yo',     letter: 'y', emoji: '🪀', imageKey: 'yoyo'      },
  { word: 'yacht',     letter: 'y', emoji: '⛵', imageKey: 'yacht'     },

  // ── Z ─────────────────────────────────────────────────────────────────────
  { word: 'zoo',       letter: 'z', emoji: '🦁', imageKey: 'zoo'       },
  { word: 'zero',      letter: 'z', emoji: '0️⃣', imageKey: 'zero'      },
  { word: 'zebra',     letter: 'z', emoji: '🦓', imageKey: 'zebra'     },
  { word: 'zipper',    letter: 'z', emoji: '🤐', imageKey: 'zipper'    },
  { word: 'zig-zag',   letter: 'z', emoji: '⚡', imageKey: 'zigzag'    },
];

export default WORD_DATA;
