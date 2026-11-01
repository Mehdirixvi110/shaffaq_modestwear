import { validateRuntimeConfiguration } from "./config/runtime";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") validateRuntimeConfiguration();
}
