import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await SecureStore.getItemAsync('api_token');
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
        throw new ApiError(response.status, data.error ?? "Something went wrong");
    }
    return data as T;
}