import api from './api';
import {
  UserLanguage,
  UserSetting,
  UserSettingApiResponse,
} from '../models/UserSettingModel';

export type AppLanguage = 'vi' | 'en' | 'ja' | 'ko';

export const toAppLanguage = (
  language: UserLanguage
): AppLanguage => {
  return language.toLowerCase() as AppLanguage;
};

export const getMySettings = async (): Promise<UserSetting> => {
  const response = await api.get<UserSettingApiResponse>('/settings');

  return response.data.result;
};