import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';


const selectConfirmSound = require(
    '../assets/sounds/select-confirm.wav'
);
const errorSound = require(
    '../assets/sounds/error.wav'
);

const cancelSound = require(
    '../assets/sounds/cancel.wav'
);
const generateQuestSound = require(
    '../assets/sounds/generate-quest.wav'
);
const countdown5sSound = require(
    '../assets/sounds/countdown-5s-phase-transition.wav'
);
const setCompleteSound = require(
    '../assets/sounds/set-complete.wav'
);

const rewardSound = require(
    '../assets/sounds/reward.wav'
);

export function useSoundEffects() {
    const selectConfirmPlayer = useAudioPlayer(selectConfirmSound);
    const errorPlayer = useAudioPlayer(errorSound);
    const cancelPlayer = useAudioPlayer(cancelSound);
    const generateQuestPlayer = useAudioPlayer(generateQuestSound);
    const playCountdown5sPlayer = useAudioPlayer(countdown5sSound);
    const setCompletePlayer = useAudioPlayer(setCompleteSound);
    const rewardPlayer = useAudioPlayer(rewardSound);

    const playSelectConfirm = useCallback(() => {
        selectConfirmPlayer.seekTo(0);
        selectConfirmPlayer.play();
    }, [selectConfirmPlayer]);

    const playError = useCallback(() => {
        errorPlayer.seekTo(0);
        errorPlayer.play();
    }, [errorPlayer]);

    const playCancel = useCallback(() => {
        cancelPlayer.seekTo(0);
        cancelPlayer.play();
    }, [cancelPlayer]);

    const playGenerateQuest = useCallback(() => {
        generateQuestPlayer.seekTo(0);
        generateQuestPlayer.play();
    }, [generateQuestPlayer]);

    const playCountdown5s = useCallback((startAt = 0 ) => {
        playCountdown5sPlayer.seekTo(startAt);
        playCountdown5sPlayer.play();
    }, [playCountdown5sPlayer]);
    const playSetComplete = useCallback(() => {
        setCompletePlayer.seekTo(0);
        setCompletePlayer.play();
    }, [setCompletePlayer]);
    const playReward = useCallback(() => {  
        rewardPlayer.seekTo(0);
        rewardPlayer.play();
    }, [rewardPlayer]);

    return {
        playSelectConfirm,
        playError,
        playCancel,
        playGenerateQuest,
        playCountdown5s,
        playSetComplete,
        playReward
    };
}