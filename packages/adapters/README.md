# packages/adapters/

Provider-specific implementations of capability **ports**. A capability defines a port (e.g. `EmailConnectorPort`, `VectorIndexPort`, `ModelInvocation`); adapters implement it for a concrete provider. This is where vendor specifics live, so capabilities stay provider-agnostic.

Each adapter is its own workspace package (`@multimarcdown/adapter-<name>`).

## Current adapters (11 seeded, all README + package.json + tsconfig.json scaffolds)

| Adapter | Implements | Used by |
|---|---|---|
| `gmail/` | `EmailConnectorPort` | email-connector |
| `imap/` | `EmailConnectorPort` | email-connector |
| `deepseek/` | `ModelInvocation` | ai-file-renamer, media-processing, web-clipper |
| `anthropic/` | `ModelInvocation` | (optional alt path for any ModelInvocation consumer) |
| `ollama/` | `ModelInvocation` | (free local path for any ModelInvocation consumer) |
| `replicate/` | `ModelInvocation` + HTTP client | media-processing |
| `ffmpeg/` | `MediaTranscodePort` | media-processing |
| `leaflet/` | `GeoLayerRenderer` | geo-visualization |
| `google-earth/` | `KmlExporter` / `KmlImporter` | geo-visualization |
| `cloudflare-vectorize/` | `VectorIndexPort` | knowledge-index |
| `local-filesystem/` | `ContentRef` driver + path normalization | ai-file-renamer, media-processing, intake-pipeline |

## Layout rule

If the adapter implements a port that's defined in a capability AND would be swappable across capabilities, it lives here. If the adapter is wire-format-bound to one capability (e.g. the PTY DO + Worker), it lives inside that capability's folder. See `packages/capabilities/local-agent-terminal/cloudflare/` for the in-capability adapter pattern.
