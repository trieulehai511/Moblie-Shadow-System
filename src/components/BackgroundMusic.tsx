import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

const backgroundMusic = require(
    '../assets/sounds/background.mp3'
);

const BACKGROUND_MUSIC_VOLUME = 0.7;

export function BackgroundMusic() {
    const player = useAudioPlayer(backgroundMusic);

    useEffect(() => {
        player.loop = true;
        player.volume = BACKGROUND_MUSIC_VOLUME;
        player.play();

        const subscription = AppState.addEventListener(
            'change',
            nextState => {
                try {
                    if (nextState === 'active') {
                        player.play();
                    } else {
                        player.pause();
                    }
                } catch (e) {
                    console.warn('AudioPlayer error on app state change:', e);
                }
            }
        );

        return () => {
            subscription.remove();
            try {
                player.pause();
            } catch (e) {
                console.warn('AudioPlayer error on cleanup:', e);
            }
        };
    }, [player]);

    return null;
}
