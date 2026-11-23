"""
Synthesises the app's UI sounds (stdlib only, deterministic).
Usage: python3 scripts/generate-sounds.py assets/sounds
Keeps the repo free of third-party audio with unclear licensing.
"""
import math, random, struct, sys, wave, os

RATE = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/sounds'
rnd = random.Random(7)

def env(t, dur, attack=0.005, release=None):
    release = release if release is not None else dur * 0.8
    if t < attack:
        return t / attack
    return max(0.0, math.exp(-(t - attack) / max(1e-4, release) * 3.0))

def bell(freq, dur, vol=0.5, partials=((1, 1), (2.01, 0.35), (3.02, 0.15), (4.1, 0.08))):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        s = sum(a * math.sin(2 * math.pi * freq * m * t) for m, a in partials)
        out.append(s * env(t, dur) * vol / 1.6)
    return out

def noise_sweep(dur, f0, f1, vol=0.4):
    """Band-limited noise with a moving one-pole low-pass: a whoosh."""
    n = int(RATE * dur)
    out, y = [], 0.0
    for i in range(n):
        t = i / RATE
        f = f0 + (f1 - f0) * (t / dur)
        a = 1 - math.exp(-2 * math.pi * f / RATE)
        y += a * ((rnd.random() * 2 - 1) - y)
        shape = math.sin(math.pi * t / dur) ** 1.5
        out.append(y * shape * vol * 2.2)
    return out

def knock(freq, dur, vol=0.6):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        f = freq * (1 + 0.6 * math.exp(-t * 60))
        s = math.sin(2 * math.pi * f * t) + 0.3 * (rnd.random() * 2 - 1) * math.exp(-t * 200)
        out.append(s * math.exp(-t * 28) * vol)
    return out

def mix(*tracks):
    """tracks: (offset_seconds, samples)"""
    length = max(int(o * RATE) + len(s) for o, s in tracks)
    buf = [0.0] * length
    for o, s in tracks:
        start = int(o * RATE)
        for i, v in enumerate(s):
            buf[start + i] += v
    return buf

def write(name, samples):
    peak = max(1e-6, max(abs(v) for v in samples))
    gain = min(1.0, 0.89 / peak)
    path = os.path.join(OUT, name)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v * gain)) * 32767)) for v in samples))
    print(path, f'{len(samples) / RATE:.2f}s')

# Notes (Hz)
C5, E5, G5, A5, C6, E6, G6, C7 = 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1568.0, 2093.0
D5, F5, B4, G4 = 587.33, 698.46, 493.88, 392.0

os.makedirs(OUT, exist_ok=True)
write('purchase.wav', mix((0, bell(G6, 0.18, 0.35)), (0.07, bell(C7, 0.32, 0.4))))
write('lid_grab.wav', knock(140, 0.18))
write('lid_open.wav', mix((0, noise_sweep(0.55, 300, 4200, 0.35)), (0.42, knock(110, 0.2, 0.4))))
write('reveal_common.wav', bell(E5, 0.6, 0.45))
write('reveal_rare.wav', mix((0, bell(C5, 0.5, 0.4)), (0.11, bell(G5, 0.8, 0.45))))
write('reveal_epic.wav', mix((0, bell(C5, 0.5)), (0.09, bell(E5, 0.5)), (0.18, bell(G5, 0.6)), (0.27, bell(C6, 1.1))))
write('reveal_legendary.wav', mix(
    (0, bell(C5, 0.6)), (0.08, bell(E5, 0.6)), (0.16, bell(G5, 0.6)), (0.24, bell(C6, 0.8)),
    (0.34, bell(E6, 1.2, 0.45)), (0.34, bell(G6, 1.4, 0.3)),
    *[(0.42 + k * 0.06, bell(C7 * (1 + 0.12 * (k % 3)), 0.25, 0.12)) for k in range(8)],
))
write('tick.wav', knock(1800, 0.03, 0.35))
write('lose.wav', mix((0, bell(D5, 0.45, 0.35)), (0.16, bell(B4, 0.7, 0.35))))
write('sell.wav', mix(*[(k * 0.045, bell(C7 * (0.9 + 0.08 * k), 0.16, 0.25)) for k in range(5)]))
write('next.wav', mix((0, noise_sweep(0.22, 600, 3000, 0.25)), (0.12, bell(A5, 0.3, 0.25))))
