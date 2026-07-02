# Sharp edges — <capability>

Document every non-obvious failure mode and the guard that handles it. If you discovered it by debugging, it belongs here.

## Shape

Each edge is a numbered H2 with a title line + body. Be specific. Cite the
function/line/memory that exhibits the issue. Generic warnings are not useful —
"the API returns 429 on burst > N/min" is.

## 1. <Short title — what surprises you>

<Why it happens (the underlying root cause, not the symptom). 2-4 sentences.
Cite the file or user memory where it first burned. Include the guard that's
in place AND the rule for a future contributor who hits this code.>

## 2. <Next edge>

<Same shape.>

## 3. <Next edge>

<Same shape.>

---

Aim for ≥3 edges before the capability ships. Zero edges = either you haven't
debugged hard enough, or the capability is too small to warrant its own page.
Either way, write what you know.
