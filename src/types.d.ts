/** preload가 노출하는 API — Electron 밖(브라우저 데모)에서는 undefined */
interface Window {
  madi?: {
    hide(): void;
    onShown(callback: () => void): () => void;
  };
}
