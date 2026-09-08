import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "../api/client";

export function useToggle(basePath: string, key: string, postBody?: Record<string, unknown>) {
    const [isOn, setIsOn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await apiFetch<Record<string, boolean>>(basePath);
                setIsOn(!!data[key]);
            } catch {
                // couldn't check current state — default to "off" rather than block the screen
            } finally {
                setIsLoading(false);
            }
        })();
    }, [basePath]);

    async function toggle() {
        setError(null);
        const next = !isOn;
        setIsOn(next); // optimistic, same pattern as the star rating
        try {
            await apiFetch(basePath, {
                method: next ? "POST" : "DELETE",
                body: next && postBody ? JSON.stringify(postBody) : undefined,
            });
        } catch (err) {
            setIsOn(!next);
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        }
    }

    return { isOn, isLoading, error, toggle };
}
