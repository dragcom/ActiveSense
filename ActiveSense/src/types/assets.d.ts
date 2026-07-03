// Metro returns bundled GLB assets as numeric module IDs on native platforms.
declare module '*.glb' {
  const asset: number;
  export default asset;
}

declare module 'base64-js' {
  export function toByteArray(base64: string): Uint8Array;
}

declare module 'three-ios' {
  export * from 'three';
}

declare module 'three-ios/examples/jsm/loaders/GLTFLoader.js' {
  export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
}
