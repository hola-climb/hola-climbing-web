import { ref } from "vue";

export function useShare() {
  const isSharing = ref(false);

  async function copyShareLink(videoId: string) {
    if (isSharing.value) return;
    isSharing.value = true;
    navigator.clipboard.writeText(`https:hola-climb.app/videos/${videoId}`);
  }
  return { isSharing, copyShareLink };
}
