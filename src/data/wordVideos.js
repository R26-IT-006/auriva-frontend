// Keyed by the exact `word` string from wordData.
// Only words whose video file exists on disk are listed here.
// All require() calls are static so Metro can bundle them at build time.
// Add a new entry here once you drop the corresponding .mp4 into assets/words-videos/<LETTER>/.

const WORD_VIDEOS = {
  apple: require('../../assets/words-videos/A/apple.mp4'),
  ball:  require('../../assets/words-videos/B/ball.mp4'),
  cat:   require('../../assets/words-videos/C/cat.mp4'),
  dog:   require('../../assets/words-videos/D/dog.mp4'),
};

export default WORD_VIDEOS;
