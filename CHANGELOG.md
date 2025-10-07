# Changelog

## [2.0.0] - 2025

### Added
- **LSP Support**: Full Language Server Protocol integration (port 6005)
  - Code diagnostics, hover info, go-to-definition, completion, symbols
- **Docker MCP Integration**: Self-contained Docker image with MCP metadata
- **Docker Networking Fix**: Proper `host.docker.internal` support for all platforms

### Changed
- Clarified port usage: 6006 for DAP (debugging), 6005 for LSP
- Improved Docker build process (fully self-contained)
- Streamlined documentation

### Fixed
- Docker networking issues on Linux (all tools now work correctly)

## [1.0.0] - 2025

### Initial Release
- Debug Adapter Protocol (DAP) support (port 6006)
- 14 debugging tools: breakpoints, execution control, variable inspection
- Thread management and stack traces
- Expression evaluation in GDScript
