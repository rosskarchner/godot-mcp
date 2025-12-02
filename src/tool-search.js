/**
 * Tool search and discovery implementation
 * Enables finding relevant tools by keyword, protocol, or category
 */

import { allTools } from './tool-metadata.js';

export class ToolSearcher {
  constructor(toolMetadata = allTools) {
    this.tools = toolMetadata;
    this.buildSearchIndex();
  }

  /**
   * Build search index for faster lookups
   */
  buildSearchIndex() {
    this.index = new Map();
    this.tools.forEach(tool => {
      // Index by name
      this.addToIndex(tool.name, tool);

      // Index by description (split into words)
      const descWords = this.extractWords(tool.description);
      descWords.forEach(word => this.addToIndex(word, tool));

      // Index by tags
      if (tool.tags) {
        tool.tags.forEach(tag => this.addToIndex(tag, tool));
      }

      // Index by category
      if (tool.category) {
        this.addToIndex(tool.category, tool);
      }
    });
  }

  /**
   * Add tool to search index
   */
  addToIndex(key, tool) {
    const normalizedKey = key.toLowerCase();
    if (!this.index.has(normalizedKey)) {
      this.index.set(normalizedKey, []);
    }
    const tools = this.index.get(normalizedKey);
    if (!tools.includes(tool)) {
      tools.push(tool);
    }
  }

  /**
   * Extract searchable words from text
   */
  extractWords(text) {
    // Split by non-alphanumeric, convert to lowercase, filter empties
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2);
  }

  /**
   * Search for tools by query
   * Returns most relevant tools based on keyword matching
   */
  search(query, filters = {}) {
    if (!query || query.trim() === '') {
      return this.getAll(filters);
    }

    const queryWords = this.extractWords(query);
    const candidates = new Map(); // tool -> relevance score

    // Score each tool based on query matches
    queryWords.forEach(word => {
      const matches = this.index.get(word) || [];
      matches.forEach(tool => {
        const score = candidates.get(tool) || 0;
        candidates.set(tool, score + 1);
      });
    });

    // Apply filters
    let results = Array.from(candidates.entries())
      .map(([tool, score]) => ({ tool, score }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.tool);

    results = this.applyFilters(results, filters);

    // Limit results to top 5
    return results.slice(0, 5);
  }

  /**
   * Apply protocol, category, and other filters
   */
  applyFilters(tools, filters = {}) {
    let filtered = tools;

    if (filters.protocol) {
      filtered = filtered.filter(
        tool => tool.protocol === filters.protocol
      );
    }

    if (filters.category) {
      filtered = filtered.filter(
        tool => tool.category === filters.category
      );
    }

    if (filters.complexity) {
      filtered = filtered.filter(
        tool => tool.complexity === filters.complexity
      );
    }

    // Filter to exclude internal tools if not explicitly requested
    if (!filters.includeInternal) {
      filtered = filtered.filter(tool => tool.protocol !== 'internal');
    }

    return filtered;
  }

  /**
   * Get tools by protocol
   */
  byProtocol(protocol) {
    return this.tools.filter(tool => tool.protocol === protocol);
  }

  /**
   * Get tools by category
   */
  byCategory(category) {
    return this.tools.filter(tool => tool.category === category);
  }

  /**
   * Get all tools, optionally filtered
   */
  getAll(filters = {}) {
    return this.applyFilters(this.tools, filters);
  }

  /**
   * Get unique categories
   */
  getCategories() {
    const categories = new Set();
    this.tools.forEach(tool => {
      if (tool.category) {
        categories.add(tool.category);
      }
    });
    return Array.from(categories).sort();
  }

  /**
   * Get unique protocols
   */
  getProtocols() {
    const protocols = new Set();
    this.tools.forEach(tool => {
      if (tool.protocol) {
        protocols.add(tool.protocol);
      }
    });
    return Array.from(protocols).sort();
  }

  /**
   * Get all unique tags
   */
  getTags() {
    const tags = new Set();
    this.tools.forEach(tool => {
      if (tool.tags) {
        tool.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }

  /**
   * Get tool by exact name match
   */
  getByName(name) {
    return this.tools.find(tool => tool.name === name);
  }
}

/**
 * Create global searcher instance
 */
export const toolSearcher = new ToolSearcher();

/**
 * Convenience function for searching
 */
export function searchTools(query, filters = {}) {
  const results = toolSearcher.search(query, filters);

  // Convert to MCP-compatible tool definitions (remove internal metadata)
  return results.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.examples && { examples: tool.examples })
  }));
}

/**
 * Get categories for documentation/help
 */
export function getCategories() {
  return toolSearcher.getCategories();
}

/**
 * Get protocols for documentation/help
 */
export function getProtocols() {
  return toolSearcher.getProtocols();
}

/**
 * Get all tags for documentation/help
 */
export function getTags() {
  return toolSearcher.getTags();
}
