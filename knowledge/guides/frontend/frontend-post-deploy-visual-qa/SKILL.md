---
name: frontend-post-deploy-visual-qa
description: Use after any frontend or UI deployment, visual fix, CRM screen change, Cloudflare Pages deploy, or claim that a rendered UI is fixed. Captures the actual deployed screen, inspects the screenshot with OCR/visual analysis, writes pessimistic devil's-advocate findings, and produces the next fix plan before calling frontend work done.
---

# Frontend Post-Deploy Visual QA

## Core Rule

Never call a frontend/UI deployment done from build output, DOM text, asset-string checks, or console health alone. Always inspect the actual rendered deployed screen.

If screenshot capture is blocked, report `BLOCKED` and do not mark the UI fixed.

## Workflow

1. Open the actual deployed product route, not only localhost, a standalone tool page, or a Pages asset URL.
2. Hard reload or cache-bust without clearing the login session.
3. Exercise the user-facing action that exposes the changed UI.
4. Capture a live viewport screenshot and save it under `.codex/reports/ui-qa/` when working in a repo.
5. Inspect the screenshot directly. Use OCR/visual analysis, not only DOM snapshots.
6. Capture the browser console/development log for the same run. For the ImpactIQ roof viewer, include GLB extraction logs, map/Leaflet errors, CDN image errors, and iframe message logs.
7. Treat missing or blocked visual assets as a failing visual finding even if the layout technically renders.
8. Write pessimistic findings: assume a client will judge the product from that one screen and the current console.
9. Create a concrete fix plan and, when the user requested implementation, start fixing the highest-impact issues.
10. After redeploying, repeat the screenshot and analysis loop.

## Pessimistic Checklist

Review the screenshot for:

- primary task clarity: can the user tell what to do next in under 5 seconds?
- visual hierarchy: is the main work object dominant?
- mode separation: are production, debug, edit, and calibration states separated?
- annotation truth: do labels and lines attach to the thing they describe?
- state honesty: disabled, pending, incomplete, and error states must look truthful.
- label readability: no tiny, overlapping, clipped, or context-free labels.
- control priority: primary actions must outrank reset, close, and secondary controls.
- panel competition: unrelated panels should not steal workspace from the active task.
- color semantics: colors must mean something and should be explained by a legend or reduced.
- density: avoid boxed-in, visually exhausting screens.
- responsiveness: verify the current viewport leaves enough room for the work surface.
- console/network health: check relevant errors when browser tooling is available.
- development-log truth: do the console, extraction logs, and network/CDN errors agree with what the UI claims?
- asset reality: required overlays/images/models must visibly load; hidden failures are not acceptable.
- geometry usefulness: roof edges must connect roof corners/planes in a way a user can interpret, not merely prove that an extractor emitted lines.

## Required Report Shape

```markdown
Frontend Visual QA: PASS | NEEDS IMPROVEMENT | BLOCKED
Surface Tested:
- <route, account/customer, viewport>

Screenshot:
- <artifact path>

What The Screenshot Actually Shows:
- <OCR / visible-state summary>

Development Log / Console Evidence:
- <relevant console, extraction, map, network, and CDN findings>

Devil's Advocate Findings:
- <specific visual or functional defect>

Fix Plan:
- <specific implementation action>

Verification Still Needed:
- <remaining live checks, viewport checks, or data states>
```

Use `PASS` only when the screenshot is clean enough for a client to use without confusion. Working-but-rough UI is `NEEDS IMPROVEMENT`.

## ImpactIQ Roof Viewer Path

For roof measurement, GLB viewer, calibration, extraction overlay, or customer-detail work:

1. Start at `https://impactiqbeta.com/dashboard`.
2. Hard reload.
3. Navigate to `https://impactiqbeta.com/app/customer/786`.
4. Click the real `3D Roof` tab.
5. Verify the iframe includes `enableExtraction=1`, `leadId=786`, and `measurementsApi=https://api.impactiq.us`.
6. Capture the full CRM viewport unless the defect is iframe-only.
