import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://shadow-system-1086471329115.asia-southeast1.run.app/shadow-system";

const api = axios.create({
    baseURL: API_URL,
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