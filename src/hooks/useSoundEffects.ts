import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';


const selectConfirmSound = require(
    '../assets/sounds/select-confirm.wav'
);


export function useSoundEffects(){
    const selectConfirmPlayer = useAudioPlayer(selectConfirmSound);

    const playSelectConfirm = useCallback(() => {
        selectConfirmPlayer.seekTo(0);
        selectConfirmPlayer.play();
    }, [selectConfirmPlayer]);

    return {
        playSelectConfirm,
    };
}