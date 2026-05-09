const ANJALIE_HELLO_AUDIOS = {
  lily:     require('../../assets/dialogue-audios/Level3/lily_hello.mp3'),
  boba:     require('../../assets/dialogue-audios/Level3/boba_hello.mp3'),
  glitter:  require('../../assets/dialogue-audios/Level3/glitter_hello.mp3'),
  megatron: require('../../assets/dialogue-audios/Level3/megatron_hello.mp3'),
};

export function getMockConversation(avatarKey, avatarDisplayName) {
  const name = avatarDisplayName ?? 'Friend';
  return [
    {
      id: 'T1',
      avatarText: 'Hello Anjalie!',
      anjalieText: `Hello ${name}!`,
      avatarAudio: require('../../assets/dialogue-audios/Level3/avatar_hello.mp3'),
      anjalieAudio: ANJALIE_HELLO_AUDIOS[avatarKey] ?? ANJALIE_HELLO_AUDIOS.lily,
      image: null,
    },
    {
      id: 'T2',
      avatarText: 'What is this?',
      anjalieText: "It's an Apple.",
      avatarAudio: require('../../assets/dialogue-audios/Level3/avatar_what.mp3'),
      anjalieAudio: require('../../assets/dialogue-audios/Level3/anjalie_apple.mp3'),
      image: require('../../assets/dialogue-images/Level3/apple.png'),
    },
    {
      id: 'T3',
      avatarText: 'What color is it?',
      anjalieText: "It's red.",
      avatarAudio: require('../../assets/dialogue-audios/Level3/avatar_color.mp3'),
      anjalieAudio: require('../../assets/dialogue-audios/Level3/anjalie_color.mp3'),
      image: null,
    },
    {
      id: 'T4',
      avatarText: 'Do you like apples?',
      anjalieText: 'Yes, I do!',
      avatarAudio: require('../../assets/dialogue-audios/Level3/avatar_apple.mp3'),
      anjalieAudio: require('../../assets/dialogue-audios/Level3/anjalie_yes.mp3'),
      image: null,
    },
    {
      id: 'T5',
      avatarText: 'Thank you! Good Bye!',
      anjalieText: 'Good Bye!',
      avatarAudio: require('../../assets/dialogue-audios/Level3/avatar_bye.mp3'),
      anjalieAudio: require('../../assets/dialogue-audios/Level3/anjalie_bye.mp3'),
      image: null,
    },
  ];
}

// Key word blanked per Anjalie turn for FillBlanksScreen
export const BLANK_CONFIG = {
  T1: { blankWord: 'Hello', before: '',           after: ' {name}!' },
  T2: { blankWord: 'Apple', before: "It's an ",   after: '.'        },
  T3: { blankWord: 'Red',   before: "It's ",       after: '.'        },
  T4: { blankWord: 'Yes',   before: '',            after: ', I do!'  },
  T5: { blankWord: 'Good Bye', before: '',         after: '!'        },
};

export const WORD_TILES = ['Hello', 'Apple', 'Red', 'Yes', 'Good Bye'];
