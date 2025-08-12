// search.js

import { ApiService } from './api-service.js';

export class Search {
	constructor() {
		this.floatingBtn = document.getElementById('floating-btn');
		this.searchPanel = document.getElementById('search-panel');
		this.searchBtn = document.getElementById('search-btn');
		this.searchInput = document.getElementById('search-input');
		this.searchQuery = document.getElementById('search-query');
		this.closeBtn = document.getElementById('close-btn');
		this.resultsBtn = document.getElementById('results-btn');

		this.results = [];

		this.lexer = this._initLexer();
		this.grammar = this._initGrammar();

		this.bindEvents();
	}

	bindEvents() {
		// Open panel
		this.floatingBtn.addEventListener('click', () => {
			this.openPanel();
		});

		// Close panel
		this.closeBtn.addEventListener('click', () => {
			this.closePanel(true);
		});

		// Real-time highlighting inside textarea
		this.searchInput.addEventListener('input', () => {
			this.searchBtn.classList.remove('active');
			const query = this.searchInput.value;
			if (!query.trim()) {
				this.searchQuery.innerHTML = 'Enter a query.';
				return;
			}
			const validationError = this._preValidate(query);
			if (validationError) {
				this.searchQuery.innerHTML = `<span style="color:#a00">${validationError}</span>`;
				return;
			}
			const result = this._parseQuery(query);
			if (result.error) {
				this.searchQuery.innerHTML = `<span style="color:#a00">${result.error}</span>`;
			} else {
				this.searchQuery.innerHTML = this._highlight(query);
				this.searchBtn.classList.add('active');
			}
		});

		// Search button click
		this.searchBtn.addEventListener('click', async () => {
			try {
				window.scrollTo({ top: 0, behavior: 'smooth' });
				document.querySelector('main').style.filter = 'blur(5px)';

				const result = await this.performSearch();

				const resultsLength = result.episodes.length;
				if (resultsLength === 0) {
					this.resultsBtn.innerHTML = `<span>No results found.</span>`;
					this.resultsBtn.style.display = 'flex';
					setTimeout(() => {
						this.resultsBtn.style.display = 'none';
						this.resultsBtn.innerHTML = '';
						this.floatingBtn.style.display = 'flex';
					}, 3000);
				} else {
					this.results = result.episodes;
					this.resultsBtn.innerHTML = `<a href="#" onclick="app.renderSearchResults();"><span>${resultsLength} results found.</span></a>`;
					this.resultsBtn.style.display = 'flex';
					this.floatingBtn.style.display = 'none';
				}

				document.querySelector('main').style.filter = 'none';
			} catch (error) {
				console.error('Error searching:', error);
			} finally {
				this.closePanel();
			}
		});
	}
	openPanel() {
		this.floatingBtn.style.display = 'none';
		this.searchPanel.classList.remove('hidden');
		this.searchInput.focus();
	}
	closePanel(showButton) {
		this.searchPanel.classList.add('hidden');

		this.searchInput.value = '';
		this.searchQuery.innerHTML = 'Enter a query.';

		if (showButton) {
			this.floatingBtn.style.display = 'flex';
		}
	}

	resetSearch() {
		this.resultsBtn.style.display = 'none';
		this.resultsBtn.innerHTML = '';

		this.floatingBtn.style.display = 'flex';
	}

	async performSearch() {
		const query = this.searchInput.value.trim();
		return await ApiService.searchEpisodes(query);
	}

	_initLexer() {
		return moo.compile({
			WS: { match: /\s+/, lineBreaks: true },
			lparen: '(',
			rparen: ')',
			colon: ':',
			AND: { match: /\b(?:AND|and)\b/ },
			OR: { match: /\b(?:OR|or)\b/ },
			NOT: { match: /\b(?:NOT|not)\b/ },
			category: 'category',
			subCategory: 'subCategory',
			type: 'type',
			quotedString: {
				match: /"(?:[^"\\]|\\.)*"/,
				value: s => s.slice(1, -1)
			},
			identifier: /[a-zA-Z0-9._-]+/
		});
	}

	_initGrammar() {
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
			{ name: 'fieldName', symbols: ['type'], postprocess: () => 'type' },
			{ name: 'fieldValue', symbols: ['quotedString'], postprocess: d => d[0] },
			{ name: 'fieldValue', symbols: ['identifier'], postprocess: d => d[0] },
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

		return nearley.Grammar.fromCompiled({
			Lexer: this.lexer,
			ParserRules: grammarRules,
			ParserStart: 'main'
		});
	}

	_preValidate(str) {
		if ((str.match(/"/g) || []).length % 2 !== 0) {
			return "Unclosed quotes detected.";
		}
		let stack = 0;
		for (let ch of str) {
			if (ch === '(') stack++;
			if (ch === ')') stack--;
			if (stack < 0) return "Closing parenthesis without opening one.";
		}
		if (stack > 0) return "Unclosed parenthesis detected.";
		return null;
	}

	_parseQuery(q) {
		try {
			const parser = new nearley.Parser(this.grammar);
			parser.feed(q.trim());
			if (parser.results.length === 0) return { error: "No complete parse found" };
			return { ast: parser.results[0] };
		} catch (e) {
			return { error: this._formatParserError(e.message) };
		}
	}

	_formatParserError(errMsg) {
		const tokenMatches = [...errMsg.matchAll(/%([a-zA-Z0-9_]+)/g)].map(m => m[1]);
		const uniqueTokens = [...new Set(tokenMatches)];
		const friendlyNames = {
			WS: "whitespace",
			identifier: "a word or number",
			quotedString: "quoted text",
			lparen: "'('",
			rparen: "')'",
			colon: "':'",
			AND: "'AND'",
			OR: "'OR'",
			NOT: "'NOT'",
			category: "'category'",
			subCategory: "'subCategory'",
			type: "'type'"
		};
		const readableTokens = uniqueTokens.map(tok => friendlyNames[tok] || tok);
		return `Unexpected input. I was expecting one of: ${readableTokens.join(", ")}.`;
	}
	_highlight(q) {
		const tokens = Array.from(this.lexer.reset(q));
		return tokens.map(tok => {
			if (tok.type === 'quotedString') return `<span style="color:#d14">"${tok.value}"</span>`;
			if (['AND', 'OR', 'NOT'].includes(tok.type)) return `<span style="color:#0077cc;font-weight:bold">${tok.value}</span>`;
			if (['category', 'subCategory', 'type'].includes(tok.type)) return `<span style="color:#0a0">${tok.value}</span>`;
			return tok.value;
		}).join('');
	}
}
