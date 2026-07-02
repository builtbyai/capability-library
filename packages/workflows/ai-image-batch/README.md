# ai-image-batch

**Composes:** media-generation, ai-orchestration, notify
**Trigger:** POST /api/workflow/ai-image-batch { prompt, fanout }
**Summary:** Parallel-think a prompt to generate N stylistically diverse variants (e.g. 'logo with adversarial + first-principles + empirical angles') -> judge picks the best -> notify on completion.

Wiring recipe; see `recipe.ts`.
