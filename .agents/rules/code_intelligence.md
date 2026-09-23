# Code Intelligence Tools

This project is configured with two powerful code intelligence engines via MCP:
1. **codebase-memory-mcp**: A high-performance codebase knowledge graph.
2. **Graft**: An AI-powered codebase context layer.

## Guidelines for Exploration
- **Skip File-by-File Exploration**: Do not rely solely on basic grep or file viewing to understand the codebase architecture or trace functions.
- **Use codebase-memory-mcp**: Utilize its 17 tools to get architecture overviews (`get_architecture`), trace call paths (`trace_path`), perform semantic search (`semantic_query`), structural search (`search_graph`), and detect changes (`detect_changes`).
- **Use Graft Tools**: Use `graft_repo_map` to orient yourself in the repository. Use `graft_find_code` for semantic questions about the code, and `graft_trace_calls` to understand blast radius and dependencies.

Always use these provided MCP tools to efficiently gather context and structural relationships in the codebase before making modifications.
