import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export function useHapticFeedback() {
    const hapticSelect = useCallback(() => {
        void Haptics.selectionAsync();
    }, []);

    const hapticLight = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const hapticMedium = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const hapticSuccess = useCallback(() => {
        void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
        );
    }, []);

    const hapticError = useCallback(() => {
        void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
        );
    }, []);

    return {
        hapticSelect,
        hapticLight,
        hapticMedium,
        hapticSuccess,
        hapticError,
    };
}
