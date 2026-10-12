import { Asset } from 'expo-asset';

// Download Metro assets before handing them to the native media player.
// Asset.downloadAsync reuses cached files and deduplicates concurrent downloads.
export async function prepareRecording(clip: number): Promise<string> {
  const asset = Asset.fromModule(clip);
  const started = Date.now();
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (__DEV__) console.info('[Lesson audio] Asset ready', {
    name: asset.name, elapsedMs: Date.now() - started,
    local: uri.startsWith('file:') || uri.startsWith('asset:'),
  });
  return uri;
}
