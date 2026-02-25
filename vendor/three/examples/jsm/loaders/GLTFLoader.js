// GLTFLoader.js r160.0 placeholder.
// NOTE: Network in this environment blocked downloading official source.
// Replace with official loader from version 0.160.0.
import * as THREE from "./three.module.js";

export class GLTFLoader {
  // Keep API-compatible signature for graceful fallbacks in main.js
  load(_url, _onLoad, _onProgress, onError) {
    if (!THREE || onError) {
      onError?.(new Error("GLTFLoader placeholder in use. Install official vendor/three/GLTFLoader.js"));
    }
  }
}
