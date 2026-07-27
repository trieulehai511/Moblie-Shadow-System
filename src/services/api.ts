import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
    throw new Error(
        'Missing EXPO_PUBLIC_API_URL. Add it to the project .env file.'
    );
}

const api = axios.create({
    baseURL: API_URL.replace(/\/+$/, ''),
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
