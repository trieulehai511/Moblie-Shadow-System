import { useCallback } from 'react';
import { useHapticFeedback } from './useHapticFeedback';
import { useSoundEffects } from './useSoundEffects';

export function useFeedback() {
    const sounds = useSoundEffects();
    const haptics = useHapticFeedback();

    const playSelectConfirm = useCallback(() => {
        sounds.playSelectConfirm();
        haptics.hapticSelect();
    }, [haptics.hapticSelect, sounds.playSelectConfirm]);

    const playError = useCallback(() => {
        sounds.playError();
        haptics.hapticError();
    }, [haptics.hapticError, sounds.playError]);

    const playCancel = useCallback(() => {
        sounds.playCancel();
        haptics.hapticLight();
    }, [haptics.hapticLight, sounds.playCancel]);

    const playGenerateQuest = useCallback(() => {
        sounds.playGenerateQuest();
        haptics.hapticMedium();
    }, [haptics.hapticMedium, sounds.playGenerateQuest]);

    const playCountdown5s = useCallback(
        (startAt = 0) => {
            sounds.playCountdown5s(startAt);
        },
        [sounds.playCountdown5s]
    );

    const playSetComplete = useCallback(() => {
        sounds.playSetComplete();
        haptics.hapticMedium();
    }, [haptics.hapticMedium, sounds.playSetComplete]);

    const playReward = useCallback(() => {
        sounds.playReward();
        haptics.hapticSuccess();
    }, [haptics.hapticSuccess, sounds.playReward]);

    return {
        playSelectConfirm,
        playError,
        playCancel,
        playGenerateQuest,
        playCountdown5s,
        playSetComplete,
        playReward,
    };
}
