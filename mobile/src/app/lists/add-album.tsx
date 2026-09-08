import { useLocalSearchParams, router } from "expo-router";
import { apiFetch } from "../../api/client";
import { AlbumSearchPicker, AlbumPickResult } from "../../components/AlbumSearchPicker";

export default function AddAlbumToListScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    async function handlePick(album: AlbumPickResult) {
        await apiFetch(`/lists/${id}/items/albums/${album.id}`, { method: "POST" });
        router.back();
    }

    return <AlbumSearchPicker onPick={handlePick} />;
}
