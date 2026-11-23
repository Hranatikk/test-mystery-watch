# Mystery Watch

A bare React Native app (TypeScript, RN 0.83, new architecture) for browsing mystery watch boxes, buying them with a virtual balance, opening them in real-time 3D, and managing the watches you win.

```sh
npm install
cd ios && LANG=en_US.UTF-8 pod install && cd ..
npm run ios        # or: npm run android
npm test           # unit + RNTL tests
npm run typecheck
```

## Stack

| Concern | Choice |
| --- | --- |
| 3D | `react-native-filament` (GLB, PBR, per-node transforms, frame loop on its own thread, no Expo) |
| Animation / gestures | Reanimated 4 + Gesture Handler 2 |
| Server state | TanStack Query (query keys act as invalidation tags) |
| Client state | zustand + `persist` |
| Persistence | MMKV: one instance for the client, one for the mock server's "database" |
| Navigation | React Navigation 7 (native stack + bottom tabs) |

Versions are pinned to the set Filament is tested against (RN 0.83 / Reanimated 4.2 / Worklets 0.7).

## Structure

```
app/        screens, navigation, app-level components, config (mock API knobs), setup
core/
  common/          money (integer cents), rarity, seeded RNG, weighted pick, errors
  design-system/   tokens + small UI kit
  modules/         catalog, wallet, collection, opening (state machine), activity (ledger, feed)
  scene/           3D layer, unaware of business logic
  overlays/        bottom sheets + toasts
  shared/          mock server, persistence, haptics, sound
stores/     app-wide instances (query client, opening, settings, wishlist)
assets/     GLB, watch images, generated UI sounds
```

## Key decisions

- **The server decides.** `core/shared/api/mockServer.ts` is the source of truth for balance, inventory, ledger and pity counters. Every mutation builds the next DB snapshot and saves it in one write, so it is all-or-nothing. The UI only animates a known result.
- **Realistic network.** Random latency, failures before the commit and responses lost after it. Money-moving calls (open, trade-up, shipping) take idempotency keys, so a retry never charges twice. RNGs are injectable for deterministic tests.
- **Opening is a pure state machine** (`core/modules/opening/machine.ts`): `inspecting → purchasing → ready → opening → revealed (→ summary)`. Network errors retry automatically with the same key. The screen can't be dismissed while money is in flight or the lid is in hand. Paid-but-unseen pulls are persisted (`pendingReveal`) and the app offers to resume them after a kill. It also checks the server for unrevealed items, in case the purchase response was lost.
- **3D.** One GLB is recoloured per box via its body/seam materials. The lid and wordmark rotate around the MODEL.md hinge (`T(p)·Rx(θ)·T(−p)`). The camera refits from closed to open bounds as the lid lifts. Lighting is an IBL plus a key and a rim light.
- **Catalogue performance.** Only the current card and its neighbours mount a live 3D view (at most 3 engines). Each view renders only while it is visible, its screen is focused and the app is active.
- **Interaction.** Free orbit with momentum, including the underside; pinch to zoom; double-tap to reset. Swipe up on the lid to open: past 35% or with a flick it springs to 115°. "Open it for me" is the accessible alternative. The watch (a 2D asset) rises out of the box in an RN layer tied to the lid angle.

## Tests

60 tests: the mock server (rolls, atomicity, idempotency, lost responses, abort, multi-open, pity, ledger, trade-up, shipping, feed, DB migration), the state machine (incl. multi-reveal), the opening store (retries, persistence and its migration), the hinge maths, and RNTL flows (purchase, insufficient funds, ×3 open → reveal → summary → sell).

## Trade-offs

- Each `BoxView` owns a Filament engine, which is why the catalogue bounds how many are mounted. Filament frees the GLB buffer after parsing, so it can't be shared between engines.
- Share-as-image uses the system share sheet. On Android some targets receive only the text.
- Watch and brand names are mock data. Sounds are synthesised by `scripts/generate-sounds.py`, so there is no third-party audio.

## Added beyond the brief

- **Reveal actions:** keep, sell back (80%) or open again, right on the reveal card.
- **Profit & loss:** collection value, spent, sold and net result, derived from the server ledger, plus a full history screen.
- **Multi-open ×3 / ×5:** one atomic payment, pulls revealed one by one with the best last, then a summary with per-item and "sell all commons" sales.
- **Pity:** each box guarantees a minimum rarity within N opens (enforced server-side), with progress shown on the box.
- **Live feed:** a ticker of recent notable pulls by simulated players, plus your own.
- **Wishlist:** heart any watch to see which boxes drop it and with what chance; boxes containing wishlisted watches are badged in the catalogue.
- **Shipping:** request insured delivery with an address form; status advances processing → shipped → delivered, with a timeline. Shipped watches can't be sold or traded.
- **Trade-up:** stake vault watches for a chance at a pricier one. The chance bar's needle lands on the server's actual roll.
- **Share card:** a rendered image of the pull (watch, rarity, value) shared via the system sheet.
- **Sound & onboarding:** rarity-scaled reveal sounds, lid and tick effects (toggle in the wallet sheet), a welcome sheet, and one-time interactive hints that the real gesture dismisses ("drag to spin", "swipe up on the lid").
