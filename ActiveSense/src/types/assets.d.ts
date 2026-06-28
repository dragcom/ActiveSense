// Metro returns bundled GLB assets as numeric module IDs on native platforms.
declare module '*.glb' {
  const asset: number;
  export default asset;
}
