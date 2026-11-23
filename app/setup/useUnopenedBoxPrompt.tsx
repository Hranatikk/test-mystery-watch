import React, { useEffect, useRef } from 'react';
import { Button } from '@core/design-system';
import { useBoxesQuery } from '@core/modules/catalog';
import { useCollectionQuery } from '@core/modules/collection';
import { SheetActions, SheetTitle, useOverlayStore } from '@core/overlays';
import { useOpeningStore } from '@stores/openingStore';
import { useRootNavigation } from '@app/navigation/hooks';

/**
 * Recovery after the app was killed mid-flow. Two sources, in priority:
 *  1. `pendingReveal` persisted on the client (killed during ready/opening),
 *  2. any `revealed: false` item on the server (e.g. killed while the purchase
 *     response was in flight — the client never learnt about it).
 * Asks once per launch.
 */
export function useUnopenedBoxPrompt() {
  const navigation = useRootNavigation();
  const { data: collection } = useCollectionQuery();
  const { data: boxes } = useBoxesQuery();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !collection || !boxes) {
      return;
    }
    const pending = useOpeningStore.getState().pendingReveal;
    const unrevealed = collection.filter(i => !i.revealed);

    // Drop pulls that were revealed or sold elsewhere; drop the whole record if none are left.
    const stillPending = pending?.results.filter(r => unrevealed.some(i => i.instanceId === r.instanceId)) ?? [];
    if (pending && stillPending.length !== pending.results.length) {
      useOpeningStore.setState({ pendingReveal: stillPending.length ? { ...pending, results: stillPending } : null });
    }

    const target = stillPending[0] ?? unrevealed[0];
    asked.current = true;
    if (!target) {
      return;
    }
    const box = boxes.find(b => b.id === target.boxId);
    const boxId = target.boxId;
    if (!boxId) {
      return;
    }
    const extra = unrevealed.length > 1 ? ` You have ${unrevealed.length} unopened boxes.` : '';

    useOverlayStore.getState().showSheet({
      key: 'unopened-box',
      render: close => (
        <>
          <SheetTitle
            title="You have an unopened box"
            subtitle={`Your ${box?.name ?? 'mystery'} box is paid for and waiting.${extra}`}
          />
          <SheetActions>
            <Button
              testID="resume-open"
              title="Open it now"
              tint={box?.theme.accent}
              onPress={() => {
                close();
                navigation.navigate('Opening', { boxId, instanceId: target.instanceId });
              }}
            />
            <Button title="Later" variant="ghost" onPress={close} />
          </SheetActions>
        </>
      ),
    });
  }, [collection, boxes, navigation]);
}
