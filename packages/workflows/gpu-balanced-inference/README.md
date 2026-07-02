# gpu-balanced-inference

**Composes:** gpu-router, deepseek-router, fleet-dispatch (tool)
**Trigger:** Inference request from any capability
**Summary:** Route inference to least-loaded fleet GPU; fall back to deepseek-router if all overloaded

This is a wiring recipe. See `recipe.ts`.
