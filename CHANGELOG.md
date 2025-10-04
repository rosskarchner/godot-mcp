# Changelog

## [2.0.0] - 2025

### Added
- **Language Server Protocol (LSP) Support** - Full integration with Godot's LSP server (port 6005)
  - `connect_lsp` - Connect to Godot's Language Server
  - `disconnect_lsp` - Disconnect from LSP server
  - `lsp_get_diagnostics` - Get real-time diagnostics (errors/warnings) for files or workspace
  - `lsp_hover` - Get hover information and documentation for symbols
  - `lsp_goto_definition` - Navigate to symbol definitions
  - `lsp_completion` - Get code completion suggestions
  - `lsp_document_symbols` - List all symbols in a document
  - `lsp_workspace_symbols` - Search for symbols across the workspace

### Changed
- Updated README.md to reflect dual protocol support (DAP + LSP)
- Removed references to port 6007 (game debug port) as it uses a different custom protocol
- Clarified that port 6006 is for editor debugging via DAP
- Updated documentation with LSP usage examples
- Bumped version to 2.0.0 to reflect significant new functionality

### Documentation
- Created `PROTOCOL_ANALYSIS.md` explaining the different protocols Godot uses
- Updated all tool descriptions to be more accurate
- Added comprehensive LSP usage examples

## [1.0.0] - 2025

### Initial Release
- Debug Adapter Protocol (DAP) support for Godot editor debugging (port 6006)
- 14 debugging tools for breakpoints, execution control, and variable inspection
- Connection management for DAP
- Full stack trace and variable inspection
- Expression evaluation in GDScript context
- Breakpoint management with conditional breakpoints
- Thread management and execution control (pause, continue, step over/into/out)
