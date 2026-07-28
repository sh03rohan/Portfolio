/**
 * Stand-in for `leva`, aliased in vite.config.js.
 *
 * ecctrl depends on leva purely for its debug GUI. It calls
 * `useControls(name, debug ? {...schema} : {}, deps)` unconditionally and then
 * reads each value with `?? fallbackProp`, so with `debug` off the returned
 * object is empty and every setting comes from the props we pass anyway.
 *
 * leva itself is ~700kB of GUI code that would otherwise ship to every
 * visitor. Returning an empty object here is behaviourally identical while
 * `debug` is false — and if you ever want ecctrl's debug panel, drop the alias
 * in vite.config.js and pass `debug` to <Ecctrl>.
 */
export const useControls = () => ({})
export const folder = (schema) => schema
export const button = () => ({})
export const monitor = () => ({})
export const Leva = () => null
export const LevaPanel = () => null
export const useCreateStore = () => ({})
export default { useControls, folder, button, Leva }
