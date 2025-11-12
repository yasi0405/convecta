// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'truck.fill': 'local-shipping',
  'truck.circle.fill': 'local-shipping',
  'cube.box.fill': 'inventory-2',
  'cube.fill': 'inventory-2',
  'shippingbox.fill': 'inventory',
  'person.fill': 'person',
  'person.circle.fill': 'person',
  'person.crop.circle': 'person',
  'plus.circle.fill': 'add-circle',
  'trash.fill': 'delete',
  'arrow.clockwise.circle.fill': 'refresh',
  'arrow.clockwise': 'refresh',
  'checkmark.circle.fill': 'check-circle',
  'xmark': 'close',
  'xmark.circle.fill': 'close',
  'rocket.fill': 'rocket-launch',
  'scanner.fill': 'qr-code-scanner',
  'camera.viewfinder': 'camera',
  'package.fill': 'inventory-2',
  'person.and.arrow.left.and.arrow.right': 'people',
  'location.fill': 'location-on',
  'qrcode.viewfinder': 'qr-code-scanner',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'stop.fill': 'stop',
  timer: 'timer',
  calendar: 'calendar-today',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
