import axios, {
    AxiosAdapter,
    AxiosError,
    AxiosResponse,
} from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch as expoFetch } from 'expo/fetch';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
    throw new Error(
        'Missing EXPO_PUBLIC_API_URL. Add it to the project .env file.'
    );
}

const expoFetchAdapter: AxiosAdapter = async (config) => {
    const baseURL = (config.baseURL || '').replace(/\/+$/, '');
    const path = (config.url || '').replace(/^\/+/, '');
    const url = `${baseURL}/${path}`;
    const method = (config.method || 'get').toUpperCase();
    const timeoutMs = config.timeout || 10_000;
    const headers = config.headers?.toJSON() as Record<string, string>;

    const request = expoFetch(url, {
        method,
        headers,
        body:
            method === 'GET' || method === 'HEAD'
                ? undefined
                : config.data,
    });
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(
                new AxiosError(
                    `timeout of ${timeoutMs}ms exceeded`,
                    AxiosError.ETIMEDOUT,
                    config
                )
            );
        }, timeoutMs);
    });
    const response = await Promise.race([request, timeout]);
    const responseData = await response.text();
    const axiosResponse: AxiosResponse = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config,
        request: null,
    };

    if (
        config.validateStatus &&
        !config.validateStatus(axiosResponse.status)
    ) {
        throw new AxiosError(
            `Request failed with status code ${axiosResponse.status}`,
            AxiosError.ERR_BAD_RESPONSE,
            config,
            null,
            axiosResponse
        );
    }

    return axiosResponse;
};

const api = axios.create({
    baseURL: API_URL.replace(/\/+$/, ''),
    adapter: expoFetchAdapter,
    timeout: 10_000,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    async (config)=>{
        const token = await AsyncStorage.getItem('token');
        if(token){
            config.headers.Authorization = `Bearer ${token}`;

        }
        return config;
    }
)

export default api;
