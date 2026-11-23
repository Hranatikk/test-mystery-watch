import Sound from 'react-native-sound';

const SOURCES = {
  purchase: require('@assets/sounds/purchase.wav'),
  lidGrab: require('@assets/sounds/lid_grab.wav'),
  lidOpen: require('@assets/sounds/lid_open.wav'),
  revealCommon: require('@assets/sounds/reveal_common.wav'),
  revealRare: require('@assets/sounds/reveal_rare.wav'),
  revealEpic: require('@assets/sounds/reveal_epic.wav'),
  revealLegendary: require('@assets/sounds/reveal_legendary.wav'),
  tick: require('@assets/sounds/tick.wav'),
  lose: require('@assets/sounds/lose.wav'),
  sell: require('@assets/sounds/sell.wav'),
  next: require('@assets/sounds/next.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

let enabled = true;
let initialised = false;
const loaded = new Map<SoundName, Sound>();

/**
 * 'Ambient' mixes with the user's music and respects the silent switch, which
 * is what UI sounds should do.
 */
function init() {
  if (initialised) {
    return;
  }
  initialised = true;
  try {
    Sound.setCategory('Ambient', true);
  } catch {
    // Not fatal: falls back to the default session.
  }
}

/** Decodes every clip up front so the first reveal doesn't stutter. Safe to call repeatedly. */
export function preloadSounds() {
  init();
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    if (!loaded.has(name)) {
      const clip = new Sound(SOURCES[name], (error: unknown) => {
        if (error) {
          loaded.delete(name);
        }
      });
      loaded.set(name, clip);
    }
  }
}

export function configureSound(options: { enabled: boolean }) {
  enabled = options.enabled;
  if (enabled) {
    preloadSounds();
  }
}

/** Fire-and-forget. Sounds are decorative: failures are swallowed. */
export function playSound(name: SoundName, volume = 1) {
  if (!enabled) {
    return;
  }
  try {
    const clip = loaded.get(name);
    if (!clip) {
      preloadSounds();
      return;
    }
    clip.stop(() => {
      clip.setVolume(volume);
      clip.play();
    });
  } catch {
    // ignore
  }
}
