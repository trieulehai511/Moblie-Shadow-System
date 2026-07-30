import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';


const selectConfirmSound = require(
    '../assets/sounds/select-confirm.wav'
);
const errorSound = require(
    '../assets/sounds/error.wav'
);

export function useSoundEffects() {
    const selectConfirmPlayer = useAudioPlayer(selectConfirmSound);
    const errorPlayer = useAudioPlayer(errorSound);


    const playSelectConfirm = useCallback(() => {
        selectConfirmPlayer.seekTo(0);
        selectConfirmPlayer.play();
    }, [selectConfirmPlayer]);

    const playError = useCallback(() => {
        errorPlayer.seekTo(0);
        errorPlayer.play();
    }, [errorPlayer]);



    return {
        playSelectConfirm,
        playError,
    };
}