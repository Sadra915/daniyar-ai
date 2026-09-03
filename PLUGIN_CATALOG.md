# Daniyar AI — Plugin Catalog

Plugins are drop-in CommonJS modules under `plugins/`. The loader discovers them automatically.

## New utility packs in V4.2
- Text: base64, line operations, word frequency, slugify, Markdown extraction, regex
- Data: number statistics, CSV conversion, JSON diff, array operations
- Web: URL parsing/query building, HTML outline/entities
- Design: CSS token extraction, color contrast
- Security: local password-strength analysis
- System: UUID and ISO date utilities
- Code: JavaScript dependency extraction and code statistics

Each plugin exposes a JSON input schema and an async handler. No fake marketplace entries are counted as installed plugins.
