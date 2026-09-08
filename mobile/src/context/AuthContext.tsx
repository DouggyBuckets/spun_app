import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../api/client";
import { getToken, setToken, deleteToken } from "../api/tokenStorage";

interface User {
    id: number;
    username: string;
}

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const token = await getToken();
                if (token) {
                    const data = await apiFetch<User>("/auth/me");
                    setUser(data);
                }
            } catch {
                await deleteToken();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    async function login(email: string, password: string) {
        const data = await apiFetch<{ token: string; user: User }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        await setToken(data.token);
        setUser(data.user);
    }

    async function register(username: string, email: string, password: string) {
        const data = await apiFetch<{ token: string; user: User }>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password }),
        });
        await setToken(data.token);
        setUser(data.user);
    }

    async function logout() {
        await deleteToken();
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
