// Placeholder file: replace with official GLTFLoader (r160) for production.
// Expected import inside this file should reference './three.module.js'.
export class GLTFLoader {
  load(_url, _onLoad, _onProgress, onError) {
    if (onError) {
      onError(new Error('GLTFLoader placeholder in use. Install real vendor/three/GLTFLoader.js'));
    }
  }
}
