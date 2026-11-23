import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

/** Navigation handle for the root stack, usable from any nested screen. */
export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

/** Cross-tab jump to a box (e.g. from the wishlist), keeping the catalogue as the back target. */
export function useOpenBoxDetails() {
  const navigation = useRootNavigation();
  return (boxId: string) =>
    navigation.navigate('Main', {
      screen: 'CatalogueTab',
      params: { screen: 'BoxDetails', params: { boxId }, initial: false },
    });
}
