export type UserRegion = 'VN' | 'US' | 'JP' | 'KR' | 'SG';

export type UserLanguage = 'VI' | 'EN' | 'JA' | 'KO';

export type UserTheme = 'SYSTEM' | 'LIGHT' | 'DARK';

export interface UserSetting {
  region: UserRegion;
  language: UserLanguage;
  theme: UserTheme;
  updatedAt: string | null;
}

export interface UserSettingApiResponse {
  result: UserSetting;
}