import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, LoadingView } from '@core/design-system';
import { RootNavigator } from '@app/navigation/RootNavigator';
import { AppProviders } from './AppProviders';
import { bootstrap } from './bootstrap';
import { useUnopenedBoxPrompt } from './useUnopenedBoxPrompt';

function AppContent() {
  useUnopenedBoxPrompt();
  return <RootNavigator />;
}

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrap()
      .catch(e => console.warn('[bootstrap] failed', e))
      .finally(() => setReady(true));
  }, []);

  return (
    <AppProviders>
      {ready ? (
        <AppContent />
      ) : (
        <View style={styles.splash}>
          <LoadingView />
        </View>
      )}
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.background },
});
