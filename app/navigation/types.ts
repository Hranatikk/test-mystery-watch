import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type CatalogueStackParamList = {
  Catalogue: undefined;
  BoxDetails: { boxId: string };
};

export type CollectionStackParamList = {
  Collection: undefined;
  WatchDetails: { instanceId: string };
  History: undefined;
  /** `preselect` stakes this watch when coming from its details screen. */
  TradeUp: { preselect?: string } | undefined;
  Shipping: { instanceId: string };
};

export type MainTabParamList = {
  CatalogueTab: NavigatorScreenParams<CatalogueStackParamList>;
  CollectionTab: NavigatorScreenParams<CollectionStackParamList>;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  /** `instanceId` resumes an already purchased, unrevealed item. */
  Opening: { boxId: string; instanceId?: string };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type CatalogueScreenProps<T extends keyof CatalogueStackParamList> = NativeStackScreenProps<
  CatalogueStackParamList,
  T
>;
export type CollectionScreenProps<T extends keyof CollectionStackParamList> = NativeStackScreenProps<
  CollectionStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
