/** Vite handles non-code imports; TypeScript only needs to know they exist. */
declare module '*.css' {
  const content: string;
  export default content;
}
