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
    const url = axios.getUri(config);
    const method = (config.method || 'get').toUpperCase();
    const timeoutMs = config.timeout || 10_000;
    const headers = config.headers?.toJSON() as Record<string, string>;

    // If sending FormData on React Native, expo/fetch does not support React Native's default FormDataPart object format ({uri, name, type}).
    // Fall back to native fetch or standard XMLHttpRequest behavior for FormData.
    const fetchFn = (config.data instanceof FormData) ? fetch : expoFetch;

    const request = fetchFn(url, {
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
    const responseDataText = await response.text();
    let responseData = responseDataText;
    try {
        responseData = JSON.parse(responseDataText);
    } catch {
        // Keep raw text if not JSON
    }
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
