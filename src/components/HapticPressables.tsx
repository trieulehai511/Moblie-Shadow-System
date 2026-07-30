import React, { useCallback } from 'react';
import {
    Pressable as NativePressable,
    PressableProps,
    TouchableOpacity as NativeTouchableOpacity,
    TouchableOpacityProps,
} from 'react-native';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export function HapticTouchableOpacity({
    onPress,
    ...props
}: TouchableOpacityProps) {
    const { hapticSelect } = useHapticFeedback();

    const handlePress = useCallback<NonNullable<TouchableOpacityProps['onPress']>>(
        event => {
            hapticSelect();
            onPress?.(event);
        },
        [hapticSelect, onPress]
    );

    return (
        <NativeTouchableOpacity
            {...props}
            onPress={handlePress}
        />
    );
}

export function HapticPressable({
    onPress,
    ...props
}: PressableProps) {
    const { hapticSelect } = useHapticFeedback();

    const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
        event => {
            hapticSelect();
            if (typeof onPress === 'function') {
                onPress(event);
            }
        },
        [hapticSelect, onPress]
    );

    return (
        <NativePressable
            {...props}
            onPress={handlePress}
        />
    );
}
