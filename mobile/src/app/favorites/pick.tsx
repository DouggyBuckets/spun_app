import { useLocalSearchParams, router } from "expo-router";
import { apiFetch } from "../../api/client";
import { AlbumSearchPicker, AlbumPickResult } from "../../components/AlbumSearchPicker";

export default function PickFavoriteScreen() {
    const { position } = useLocalSearchParams<{ position: string }>();

    async function handlePick(album: AlbumPickResult) {
        await apiFetch(`/favorites/albums/${position}`, {
            method: "PUT",
            body: JSON.stringify({ spotifyId: album.id }),
        });
        router.back();
    }

    return <AlbumSearchPicker onPick={handlePick} />;
}
