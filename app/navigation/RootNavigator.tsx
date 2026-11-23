import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, Icon } from '@core/design-system';
import { BalanceBadge } from '@app/components/BalanceBadge';
import { BoxDetailsScreen } from '@app/screens/box-details/BoxDetailsScreen';
import { CatalogueScreen } from '@app/screens/catalogue/CatalogueScreen';
import { CollectionScreen } from '@app/screens/collection/CollectionScreen';
import { OpeningScreen } from '@app/screens/opening/OpeningScreen';
import { HistoryScreen } from '@app/screens/history/HistoryScreen';
import { ShippingScreen } from '@app/screens/shipping/ShippingScreen';
import { TradeUpScreen } from '@app/screens/trade-up/TradeUpScreen';
import { WatchDetailsScreen } from '@app/screens/watch-details/WatchDetailsScreen';
import type {
  CatalogueStackParamList,
  CollectionStackParamList,
  MainTabParamList,
  RootStackParamList,
} from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const CatalogueStack = createNativeStackNavigator<CatalogueStackParamList>();
const CollectionStack = createNativeStackNavigator<CollectionStackParamList>();

const renderBalance = () => <BalanceBadge />;

/** Every tab shows the balance in its header. */
const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  headerRight: renderBalance,
  contentStyle: { backgroundColor: colors.background },
};

const transparentHeader: NativeStackNavigationOptions = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
};

function CatalogueNavigator() {
  return (
    <CatalogueStack.Navigator screenOptions={stackScreenOptions}>
      <CatalogueStack.Screen name="Catalogue" component={CatalogueScreen} options={{ title: 'Mystery Watch' }} />
      <CatalogueStack.Screen name="BoxDetails" component={BoxDetailsScreen} options={transparentHeader} />
    </CatalogueStack.Navigator>
  );
}

function CollectionNavigator() {
  return (
    <CollectionStack.Navigator screenOptions={stackScreenOptions}>
      <CollectionStack.Screen name="Collection" component={CollectionScreen} options={{ title: 'Collection' }} />
      <CollectionStack.Screen name="WatchDetails" component={WatchDetailsScreen} options={transparentHeader} />
      <CollectionStack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <CollectionStack.Screen name="TradeUp" component={TradeUpScreen} options={{ title: 'Trade up' }} />
      <CollectionStack.Screen name="Shipping" component={ShippingScreen} options={{ title: 'Ship to me' }} />
    </CollectionStack.Navigator>
  );
}

const boxIcon = ({ color }: { color: string }) => <Icon name="box" size={22} color={color} />;
const gridIcon = ({ color }: { color: string }) => <Icon name="grid" size={20} color={color} />;

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="CatalogueTab"
        component={CatalogueNavigator}
        options={{ title: 'Boxes', tabBarIcon: boxIcon, tabBarButtonTestID: 'tab-boxes' }}
      />
      <Tabs.Screen
        name="CollectionTab"
        component={CollectionNavigator}
        options={{ title: 'Collection', tabBarIcon: gridIcon, tabBarButtonTestID: 'tab-collection' }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Root.Screen name="Main" component={MainTabs} />
      <Root.Screen
        name="Opening"
        component={OpeningScreen}
        options={{
          // Fullscreen, modal-like entrance. A real card (not a native modal) so
          // that the app-level overlay host (sheets/toasts) stays on top of it.
          animation: 'slide_from_bottom',
          gestureDirection: 'vertical',
          fullScreenGestureEnabled: true,
          // Toggled at runtime by the screen depending on the opening state.
          gestureEnabled: true,
        }}
      />
    </Root.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
