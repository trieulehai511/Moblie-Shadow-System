import api from './api';
import {
  UserLanguage,
  UserSetting,
  UserSettingApiResponse,
} from '../models/UserSettingModel';

export type AppLanguage = 'vi' | 'en' | 'ja' | 'ko';

export interface UpdateUserSettingRequest{
    region: UserSetting['region'];
    language: UserSetting['language'];
    theme: UserSetting['theme'];
}


export const toAppLanguage = (
  language: UserLanguage
): AppLanguage => {
  return language.toLowerCase() as AppLanguage;
};

export const getMySettings = async (): Promise<UserSetting> => {
  const response = await api.get<UserSettingApiResponse>('/settings');

  return response.data.result;
};

export const updateMySettings = async (
  settings: UpdateUserSettingRequest
): Promise<UserSetting> => {
  const response = await api.put<UserSettingApiResponse>(
    '/settings',
    settings
  );

  return response.data.result;
};