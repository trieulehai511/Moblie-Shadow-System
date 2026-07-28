import { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';
import api from './api';
import { HunterProfileResponse } from '../models/ProfileModel';

export type ProfileRequest = {
    fullName: string;
    age: number;
    avatar?: string;
};

type ApiResponse<T> = {
    result: T;
};

export async function updateMyProfile(
    request: ProfileRequest,
    avatarFile?: ImagePickerAsset
): Promise<HunterProfileResponse> {
    const formData = new FormData();

    formData.append('fullName', request.fullName);
    formData.append('age', String(request.age));
    if (request.avatar) {
        formData.append('avatar', request.avatar);
    }

    if (avatarFile) {
        const fileName =
            avatarFile.fileName ??
            `avatar-${Date.now()}.${avatarFile.mimeType?.split('/')[1] ?? 'jpg'}`;
        const mimeType = avatarFile.mimeType ?? 'image/jpeg';

        if (Platform.OS === 'web') {
            const fileResponse = await fetch(avatarFile.uri);
            const blob = await fileResponse.blob();
            formData.append(
                'avatarFile',
                new File([blob], fileName, { type: mimeType })
            );
        } else {
            formData.append('avatarFile', {
                uri: avatarFile.uri,
                name: fileName,
                type: mimeType,
            } as any);
        }
    }

    const response = await api.put<ApiResponse<HunterProfileResponse>>(
        '/hunter/profile',
        formData,
        {
            // Xóa application/json mặc định để Axios tự sinh multipart boundary.
            headers: {
                'Content-Type': undefined,
            },
        }
    );

    return response.data.result;
}
