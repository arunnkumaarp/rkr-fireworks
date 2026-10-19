import { useState } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number };

/** A Pressable that springs down while pressed and back with a small overshoot on release. */
export function PressScale({ style, scaleTo = 0.95, onPressIn, onPressOut, ...rest }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: value === 1 ? 10 : 0 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}
