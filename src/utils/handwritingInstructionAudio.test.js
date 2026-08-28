const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(FRONTEND_ROOT, relativePath), 'utf8');

const EXPECTED_AUDIO = {
  FOLLOW_PATH: 'follow_path.mp4',
  WATCH_TRACE: 'watch_trace.mp4',
  FOLLOW_GUIDE: 'follow_guide.mp4',
  WRITE_BY_YOURSELF: 'write_by_yourself.mp4',
  CHOOSE_FIRST_LETTER: 'choose_first_letter.mp4',
  CHOOSE_PICTURE: 'choose_picture.mp4',
  CHOOSE_MISSING_LETTER: 'choose_missing_letter.mp4',
  MAKE_WORD: 'make_word.mp4',
  WRITE_WORD: 'write_word.mp4',
};

describe('fixed handwriting instruction audio map', () => {
  const source = read('src/constants/handwritingInstructionAudio.js');

  test.each(Object.entries(EXPECTED_AUDIO))('%s maps only to %s', (key, file) => {
    expect(source).toContain(`[INSTRUCTION_KEYS.${key}]: require('../../assets/handwriting_instructions/${file}')`);
    expect(fs.existsSync(path.join(FRONTEND_ROOT, 'assets/handwriting_instructions', file))).toBe(true);
  });

  test('contains exactly the nine fixed recordings', () => {
    expect((source.match(/\[INSTRUCTION_KEYS\./g) ?? [])).toHaveLength(9);
    expect(fs.existsSync(path.join(FRONTEND_ROOT, 'assets/handwriting_instructions/choose_picture.mp3.mp4'))).toBe(false);
  });
});

describe('screen wiring and TTS boundary', () => {
  const preWriting = read('src/screens/handwriting/PreWritingActivityScreen.js');
  const lower = read('src/screens/handwriting/LetterWritingScreen.js');
  const upper = read('src/screens/handwriting/uppercase/UppercaseWritingScreen.js');
  const wordWriting = read('src/screens/handwriting/words/WordWritingScreen.js');
  const wordPractice = read('src/screens/handwriting/words/WordActivityScreen.js');
  const hook = read('src/utils/useInstructionAudio.js');

  test('Pre-Writing uses FOLLOW_PATH recording for autoplay and replay', () => {
    expect(preWriting).toMatch(/useInstructionAudio\(INSTRUCTION_KEYS\.FOLLOW_PATH/);
    expect(preWriting).toMatch(/autoPlay:\s*true/);
    expect(preWriting).toMatch(/onPress=\{replayInstruction\}/);
    expect(preWriting).not.toMatch(/Speech\.speak\(PRE_WRITING_INSTRUCTION/);
  });

  test.each([
    ['lowercase', lower],
    ['uppercase', upper],
  ])('%s resolves WATCH_TRACE/FOLLOW_GUIDE/WRITE_BY_YOURSELF from support level', (_name, source) => {
    expect(source).toContain('useInstructionAudioState(instructionKey');
    expect(source).toContain('SUPPORT_INSTRUCTION_KEY[supportLevel]');
    expect(source).toContain('autoPlay: Boolean(instructionKey)');
    expect(source).toContain('onPlayInstruction={replaySupportInstruction}');
  });

  test('Word Writing resolves support recording separately from word TTS', () => {
    expect(wordWriting).toContain('SUPPORT_INSTRUCTION_KEY[supportLevel]');
    expect(wordWriting).toContain('autoPlay: true');
    expect(wordWriting).toContain('onPlayInstruction={replaySupportInstruction}');
    expect(wordWriting).toMatch(/spokenWord\(/);
    expect(wordWriting).toMatch(/spokenLetter\(/);
    expect(wordWriting).toContain('language: SPEECH_LOCALE_EN');
  });

  test.each(Object.keys(EXPECTED_AUDIO).slice(4).map((key, index) => [String.fromCharCode(65 + index), key]))(
    'Word Practice %s uses %s', (exercise, key) => {
      expect(wordPractice).toContain(`${exercise}: INSTRUCTION_KEYS.${key}`);
    },
  );

  test('dynamic target letter and current-word en-GB TTS remains', () => {
    expect(lower).toMatch(/Speech\.speak\([\s\S]*?language: SPEECH_LOCALE_EN/);
    expect(upper).toMatch(/Speech\.speak\([\s\S]*?language: SPEECH_LOCALE_EN/);
    expect(wordPractice).toMatch(/spokenWord\(currentWord\)/);
    expect(wordPractice).toContain('language: SPEECH_LOCALE_EN');
  });

  test('focus cleanup stops recordings on key/activity changes, blur, and unmount', () => {
    expect(hook).toContain('useFocusEffect');
    expect(hook).toContain('autoPlayToken');
    expect(hook).toContain('stopInstructionAudio();');
  });
});

describe('instruction player serialization and failure safety', () => {
  let mockCreateAsync;
  let mockFromModule;
  let player;

  const makeSound = () => ({
    stopAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
    playAsync: jest.fn().mockResolvedValue(undefined),
    setOnPlaybackStatusUpdate: jest.fn(),
  });

  beforeEach(() => {
    jest.resetModules();
    mockCreateAsync = jest.fn();
    mockFromModule = jest.fn(() => ({ downloaded: true, localUri: 'file:///instruction.mp4' }));
    jest.doMock('expo-av', () => ({ Audio: { Sound: { createAsync: mockCreateAsync } } }));
    jest.doMock('expo-asset', () => ({ Asset: { fromModule: mockFromModule } }));
    jest.doMock('../constants/handwritingInstructionAudio', () => ({
      getHandwritingInstructionAudio: (key) => key === 'MISSING' ? null : 101,
    }));
    player = require('./handwritingInstructionAudio');
  });

  test('replay stops and unloads the previous recording before starting again', async () => {
    const first = makeSound();
    const second = makeSound();
    mockCreateAsync
      .mockResolvedValueOnce({ sound: first })
      .mockResolvedValueOnce({ sound: second });

    await player.playInstructionAudio('WATCH_TRACE');
    await player.playInstructionAudio('WATCH_TRACE');

    expect(first.stopAsync).toHaveBeenCalledTimes(1);
    expect(first.unloadAsync).toHaveBeenCalledTimes(1);
    expect(second.playAsync).toHaveBeenCalledTimes(1);
  });

  test('rapid taps are coalesced so recordings cannot overlap', async () => {
    const latest = makeSound();
    mockCreateAsync.mockResolvedValue({ sound: latest });

    const staleRequest = player.playInstructionAudio('WATCH_TRACE');
    const latestRequest = player.playInstructionAudio('WATCH_TRACE');

    await expect(staleRequest).resolves.toBeNull();
    await expect(latestRequest).resolves.toBe(true);
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
  });

  test('explicit cleanup stops and unloads active playback', async () => {
    const sound = makeSound();
    mockCreateAsync.mockResolvedValue({ sound });
    await player.playInstructionAudio('FOLLOW_GUIDE');
    await player.stopInstructionAudio();
    expect(sound.stopAsync).toHaveBeenCalledTimes(1);
    expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
  });

  test('missing assets and playback failures return false without throwing', async () => {
    const missingEnd = jest.fn();
    await expect(player.playInstructionAudio('MISSING', { onPlaybackEnd: missingEnd })).resolves.toBe(false);
    expect(missingEnd).toHaveBeenCalledWith('failed');
    expect(mockCreateAsync).not.toHaveBeenCalled();

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreateAsync.mockRejectedValueOnce(new Error('load failed'));
    await expect(player.playInstructionAudio('WRITE_WORD')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalled();
    console.warn.mockRestore();
  });

  test('unlocks only when the recording reports didJustFinish', async () => {
    const sound = makeSound();
    const onPlaybackEnd = jest.fn();
    mockCreateAsync.mockResolvedValue({ sound });

    await player.playInstructionAudio('WATCH_TRACE', { onPlaybackEnd });
    const onStatus = sound.setOnPlaybackStatusUpdate.mock.calls[0][0];
    onStatus({ isLoaded: true, isPlaying: true, didJustFinish: false });
    expect(onPlaybackEnd).not.toHaveBeenCalled();

    onStatus({ isLoaded: true, isPlaying: false, didJustFinish: true });
    expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
    expect(onPlaybackEnd).toHaveBeenCalledWith('completed');
  });

  test('reports a runtime decoder/playback error so the fallback can release the gate', async () => {
    const sound = makeSound();
    const onPlaybackEnd = jest.fn();
    mockCreateAsync.mockResolvedValue({ sound });

    await player.playInstructionAudio('WATCH_TRACE', { onPlaybackEnd });
    const onStatus = sound.setOnPlaybackStatusUpdate.mock.calls[0][0];
    onStatus({ isLoaded: false, error: 'decoder failed' });

    expect(onPlaybackEnd).toHaveBeenCalledWith('failed');
  });
});
