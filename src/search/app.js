class BrowserQueryBuilder {
  constructor() {
    this._initializeGrammar();
  }

  _initializeGrammar() {
    // Same lexer as your server-side implementation
    const lexer = moo.compile({
      WS: { match: /\s+/, lineBreaks: true },
      lparen: '(',
      rparen: ')',
      colon: ':',
      AND: ['AND', 'and'],
      OR: ['OR', 'or'],
      NOT: ['NOT', 'not'],
      category: 'category',
      subCategory: 'subCategory',
      type: 'type',
      quotedString: {
        match: /"(?:[^"\\]|\\.)*"/,
        value: s => s.slice(1, -1)
      },
      identifier: /[a-zA-Z0-9._-]+/
    });

    // Same grammar rules as your server implementation
    const grammarRules = [
      { name: 'main', symbols: ['_', 'expression', '_'], postprocess: d => d[1] },
      { name: 'expression', symbols: ['expression', '_', 'OR', '_', 'andExpression'], postprocess: d => ({ type: 'OR', left: d[0], right: d[4] }) },
      { name: 'expression', symbols: ['andExpression'], postprocess: d => d[0] },
      { name: 'andExpression', symbols: ['andExpression', '_', 'AND', '_', 'notExpression'], postprocess: d => ({ type: 'AND', left: d[0], right: d[4] }) },
      { name: 'andExpression', symbols: ['andExpression', '__', 'notExpression'], postprocess: d => ({ type: 'AND', left: d[0], right: d[2] }) },
      { name: 'andExpression', symbols: ['notExpression'], postprocess: d => d[0] },
      { name: 'notExpression', symbols: ['NOT', '__', 'atom'], postprocess: d => ({ type: 'NOT', operand: d[2] }) },
      { name: 'notExpression', symbols: ['atom'], postprocess: d => d[0] },
      { name: 'atom', symbols: ['lparen', '_', 'expression', '_', 'rparen'], postprocess: d => d[2] },
      { name: 'atom', symbols: ['term'], postprocess: d => d[0] },
      { name: 'term', symbols: ['fieldSearch'], postprocess: d => d[0] },
      { name: 'term', symbols: ['quotedString'], postprocess: d => ({ type: 'TERM', field: 'text', value: d[0] }) },
      { name: 'term', symbols: ['identifier'], postprocess: d => ({ type: 'TERM', field: 'text', value: d[0] }) },
      { name: 'fieldSearch', symbols: ['fieldName', '_', 'colon', '_', 'fieldValue'], postprocess: d => ({ type: 'TERM', field: d[0], value: d[4] }) },
      { name: 'fieldName', symbols: ['category'], postprocess: () => 'category' },
      { name: 'fieldName', symbols: ['subCategory'], postprocess: () => 'subCategory' },
      { name: 'fieldName', symbols: ['type'], postprocess: () => 'category' },
      { name: 'fieldValue', symbols: ['quotedString'], postprocess: d => d[0] },
      { name: 'fieldValue', symbols: ['identifier'], postprocess: d => d[0] },
      // Terminal symbols
      { name: 'OR', symbols: [{ type: 'OR' }], postprocess: d => d[0].value },
      { name: 'AND', symbols: [{ type: 'AND' }], postprocess: d => d[0].value },
      { name: 'NOT', symbols: [{ type: 'NOT' }], postprocess: d => d[0].value },
      { name: 'lparen', symbols: [{ type: 'lparen' }], postprocess: d => d[0].value },
      { name: 'rparen', symbols: [{ type: 'rparen' }], postprocess: d => d[0].value },
      { name: 'colon', symbols: [{ type: 'colon' }], postprocess: d => d[0].value },
      { name: 'category', symbols: [{ type: 'category' }], postprocess: d => d[0].value },
      { name: 'subCategory', symbols: [{ type: 'subCategory' }], postprocess: d => d[0].value },
      { name: 'type', symbols: [{ type: 'type' }], postprocess: d => d[0].value },
      { name: 'quotedString', symbols: [{ type: 'quotedString' }], postprocess: d => d[0].value },
      { name: 'identifier', symbols: [{ type: 'identifier' }], postprocess: d => d[0].value },
      { name: '_', symbols: [], postprocess: () => null },
      { name: '_', symbols: [{ type: 'WS' }], postprocess: () => null },
      { name: '__', symbols: [{ type: 'WS' }], postprocess: () => null }
    ];

    this.grammar = nearley.Grammar.fromCompiled({
      Lexer: lexer,
      ParserRules: grammarRules,
      ParserStart: 'main'
    });
  }

  parse(queryString) {
    if (!queryString || typeof queryString !== 'string') {
      return { success: false, error: 'Invalid query string' };
    }

    try {
      const parser = new nearley.Parser(this.grammar);
      parser.feed(queryString.trim());

      if (parser.results.length === 0) {
        return { success: false, error: 'No valid parse found' };
      }

      return { success: true, ast: parser.results[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getTokens(queryString) {
    try {
      const lexer = moo.compile({
        WS: { match: /\s+/, lineBreaks: true },
        lparen: '(',
        rparen: ')',
        colon: ':',
        AND: ['AND', 'and'],
        OR: ['OR', 'or'],
        NOT: ['NOT', 'not'],
        category: 'category',
        subCategory: 'subCategory',
        type: 'type',
        quotedString: /"(?:[^"\\]|\\.)*"/,
        identifier: /[a-zA-Z0-9._-]+/
      });

      lexer.reset(queryString);
      const tokens = [];
      let token;
      while ((token = lexer.next())) {
        tokens.push({
          type: token.type,
          value: token.value,
          offset: token.offset,
          length: token.text.length
        });
      }
      return tokens;
    } catch (error) {
      return [];
    }
  }
}

function defineSearchMode(CodeMirror) {
  CodeMirror.defineMode('searchQuery', function (config, parserConfig) {
    const queryBuilder = new BrowserQueryBuilder();

    return {
      startState: function () {
        return {
          tokenCache: [],
          lastQuery: '',
          parseError: null
        };
      },

      token: function (stream, state) {
        const currentLine = stream.string;

        // If we're at the start of a new line or the query changed, re-tokenize
        if (stream.sol() || state.lastQuery !== currentLine) {
          state.tokenCache = queryBuilder.getTokens(currentLine);
          state.lastQuery = currentLine;

          // Check for parse errors
          const parseResult = queryBuilder.parse(currentLine);
          state.parseError = parseResult.success ? null : parseResult.error;
        }

        // Find the token at current position
        const pos = stream.pos;
        const token = state.tokenCache.find(t =>
          t.offset <= pos && pos < t.offset + t.length
        );

        if (token) {
          // Move stream to end of token
          stream.pos = Math.min(stream.string.length, token.offset + token.length);

          // Return appropriate CSS class based on token type
          switch (token.type) {
            case 'AND':
            case 'OR':
            case 'NOT':
              return 'keyword';
            case 'category':
            case 'subCategory':
            case 'type':
              return 'field';
            case 'quotedString':
              return 'string';
            case 'colon':
            case 'lparen':
            case 'rparen':
              return 'operator';
            case 'identifier':
              return 'identifier';
            case 'WS':
              return null;
            default:
              return null;
          }
        } else {
          // No token found, advance one character
          stream.next();
          return state.parseError ? 'error' : null;
        }
      }
    };
  });
}

class SearchInterface {
  constructor() {
    this.queryBuilder = new BrowserQueryBuilder();
    this.editor = null;
    this.initializeEditor();
    this.bindEvents();
  }

  initializeEditor() {
    // Define the custom mode
    defineSearchMode(CodeMirror);

    this.editor = CodeMirror.fromTextArea(document.getElementById('queryInput'), {
      mode: 'searchQuery',
      theme: 'github',
      lineNumbers: false,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      placeholder: 'Enter your search query...',
      extraKeys: {
        'Ctrl-Enter': () => this.executeSearch(),
        'Cmd-Enter': () => this.executeSearch()
      }
    });

    // Real-time validation
    this.editor.on('change', () => {
      this.validateQuery();
    });
  }

  setQuery(query) {
    if (this.editor) {
      this.editor.setValue(query);
    } else {
      document.getElementById('queryInput').value = query;
    }
    this.currentQuery = query;
    this.validateQuery();
  }

  validateQuery() {
    const query = this.editor.getValue();
    if (!query.trim()) {
      this.clearError();
      return;
    }

    const result = this.queryBuilder.parse(query);
    if (!result.success) {
      this.showError(result.error);
    } else {
      this.clearError();
    }
  }

  executeSearch() {
    const query = this.editor.getValue().trim();
    if (!query) return;

    const parseResult = this.queryBuilder.parse(query);
    if (!parseResult.success) {
      this.showError(`Syntax error: ${parseResult.error}`);
      return;
    }

    this.performSearch(query);
  }

  async performSearch(query) {
    try {
      this.setLoading(true);
      const response = await fetch(`http://localhost:7071/api/query?q=${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (response.ok) {
        this.displayResults(data);
      } else {
        this.showError(data.error || 'Search failed');
      }
    } catch (error) {
      this.showError('Network error: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }
  displayResults(data) {
    const container = document.getElementById('resultsContainer');
    const content = document.getElementById('resultsContent');

    if (!data || (Array.isArray(data) && data.length === 0)) {
      content.innerHTML = '<p>No results found for your query.</p>';
    } else if (typeof data === 'string') {
      content.innerHTML = `<pre>${this.escapeHtml(data)}</pre>`;
    } else {
      content.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setLoading(loading) {
    this.isLoading = loading;
    const button = document.getElementById('searchButton');
    const indicator = document.getElementById('loadingIndicator');

    if (loading) {
      button.disabled = true;
      button.textContent = 'Searching...';
      indicator.style.display = 'flex';
    } else {
      button.disabled = false;
      button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Search
            `;
      indicator.style.display = 'none';
    }
  }
  showError(message) {
    // Update error display
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  clearError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.style.display = 'none';
    }
  }

  bindEvents() {
    // Search button
    document.getElementById('searchButton').addEventListener('click', () => {
      this.executeSearch();
    });

    // Help modal
    document.getElementById('helpButton').addEventListener('click', () => {
      this.showHelp();
    });

    document.getElementById('closeHelp').addEventListener('click', () => {
      this.hideHelp();
    });

    document.getElementById('helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') {
        this.hideHelp();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideHelp();
      }
    });

    // Example queries in help modal
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('query-example')) {
        const query = e.target.textContent;
        this.setQuery(query);
        this.hideHelp();
      }
    });
  }

  showHelp() {
    document.getElementById('helpModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  hideHelp() {
    document.getElementById('helpModal').style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SearchInterface();
});