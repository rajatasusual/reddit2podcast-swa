import { ApiService } from './api-service.js';

export class Filter {
    constructor() {
        this.currentStep = 1;
        this.maxStep = 2;
        this.selectedData = {
            dateRange: { start: null, end: null },
            subreddits: [],
            categories: [],
            subcategories: []
        };

        this.elements = {
            panel: null,
            step1: null,
            step2: null,
            dateStart: null,
            dateEnd: null,
            nextBtn: null,
            backBtn: null,
            applyBtn: null
        };

        this.initializeElements();
        this.bindEvents();
    }

    async initializeElements() {
        this.elements.panel = document.getElementById('filter-panel');
        this.elements.step1 = document.getElementById('filter-step-1');
        this.elements.step2 = document.getElementById('filter-step-2');
        this.elements.dateStart = document.getElementById('filter-date-start');
        this.elements.dateEnd = document.getElementById('filter-date-end');
        this.elements.nextBtn = document.getElementById('filter-next-btn');
        this.elements.backBtn = document.getElementById('filter-back-btn');
        this.elements.applyBtn = document.getElementById('filter-apply-btn');

        // Fetch and set date range
        const dateRange = await ApiService.fetchDateRange();
        this.setDateRange(dateRange.minDate, dateRange.maxDate);

        // Load subreddits
        await this.loadSubreddits();
    }

    bindEvents() {
        // Date range validation
        this.elements.dateStart?.addEventListener('change', () => this.validateStep1());
        this.elements.dateEnd?.addEventListener('change', () => this.validateStep1());

        // Quick date range buttons
        document.querySelectorAll('.filter-date-quick button').forEach(btn => {
            btn.addEventListener('click', (e) => this.setQuickDateRange(e.target.dataset.range));
        });

        // Navigation buttons
        this.elements.nextBtn?.addEventListener('click', async () => this.nextStep());
        this.elements.backBtn?.addEventListener('click', () => this.previousStep());
        
        // Tag container clicks
        document.getElementById('subreddit-tags')?.addEventListener('click', () => this.openSubredditSelector());
        document.getElementById('category-tags')?.addEventListener('click', () => this.openCategorySelector());
        document.getElementById('subcategory-tags')?.addEventListener('click', () => this.openSubcategorySelector());
    }

    async startFiltering() {
        try {
            this.currentStep = 1;
            this.showStep(1);

            this.elements.panel.style.display = 'block';

        } catch (error) {
            console.error('Error opening filter panel:', error);
        }
    }

    closeFilter() {
        this.elements.panel.style.display = 'none';
        this.resetFilter();
    }

    setDateRange(minDate, maxDate) {
        this.elements.dateStart.min = minDate;
        this.elements.dateStart.max = maxDate;
        this.elements.dateEnd.min = minDate;
        this.elements.dateEnd.max = maxDate;

        this.elements.dateStart.value = minDate;
        this.elements.dateEnd.value = maxDate;

        this.selectedData.dateRange = { start: minDate, end: maxDate };
        this.validateStep1();
    }

    setQuickDateRange(range) {
        const today = new Date();
        let startDate, endDate = today;

        if (range === 'week') {
            const day = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - day);
        } else if (range === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        const fmt = d => d.toISOString().split('T')[0];
        this.elements.dateStart.value = fmt(startDate);
        this.elements.dateEnd.value = fmt(endDate);

        this.selectedData.dateRange = { start: fmt(startDate), end: fmt(endDate) };
        this.validateStep1();
    }

    async loadSubreddits() {
        try {
            const subreddits = await ApiService.fetchSubreddits();
            this.populateSelect('subreddit-select', subreddits);
        } catch (error) {
            console.error('Error loading subreddits:', error);
        }
    }

    async loadCategories() {
        try {
            const categories = await ApiService.fetchCategories(this.selectedData.subreddits);
            this.populateSelect('category-select', categories);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadSubcategories() {
        try {
            const categories = this.selectedData.categories.map(c => c.value || c);
            const subcategories = await ApiService.fetchSubCategories(categories);
            this.populateSelect('subcategory-select', subcategories);
        } catch (error) {
            console.error('Error loading subcategories:', error);
        }
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        select.innerHTML = '';

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value || option;
            optionElement.textContent = option.label || option;
            select.appendChild(optionElement);
        });
    }

    openSubredditSelector() {
        this.showMultiSelectModal('subreddit-select', 'Select Subreddits', (selected) => {
            this.selectedData.subreddits = selected;
            this.updateTagDisplay('subreddit-tags', selected);
            this.validateStep1();
        });
    }

    openCategorySelector() {
        this.showMultiSelectModal('category-select', 'Select Categories', async (selected) => {
            this.selectedData.categories = selected;
            this.updateTagDisplay('category-tags', selected);
            this.validateStep2();
            await this.loadSubcategories();
        });
    }

    openSubcategorySelector() {
        this.showMultiSelectModal('subcategory-select', 'Select Subcategories', (selected) => {
            this.selectedData.subcategories = selected;
            this.updateTagDisplay('subcategory-tags', selected);
        });
    }

    showMultiSelectModal(selectId, title, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'multiselect-modal';
        modal.innerHTML = `
            <div class="multiselect-content">
                <h3>${title}</h3>
                <div class="multiselect-options" id="modal-options"></div>
                <div class="multiselect-actions">
                    <button id="modal-cancel">Cancel</button>
                    <button id="modal-confirm">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const select = document.getElementById(selectId);
        const optionsContainer = document.getElementById('modal-options');
        const selectedValues = [];

        Array.from(select.options).forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'multiselect-option';
            optionDiv.innerHTML = `
                <input type="checkbox" id="opt-${option.value}" value="${option.value}">
                <label for="opt-${option.value}">${option.textContent}</label>
            `;

            const checkbox = optionDiv.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedValues.push({ value: option.value, label: option.textContent });
                } else {
                    const index = selectedValues.findIndex(item => item.value === option.value);
                    if (index > -1) selectedValues.splice(index, 1);
                }
            });

            optionsContainer.appendChild(optionDiv);
        });

        document.getElementById('modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('modal-confirm').addEventListener('click', async () => {
            await onConfirm(selectedValues);
            document.body.removeChild(modal);
        });

        modal.style.display = 'flex';
    }

    updateTagDisplay(containerId, items) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        items.forEach((item, index) => {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `
                <span>${item.label || item}</span>
                <button class="remove" data-index="${index}">×</button>
            `;

            tag.querySelector('.remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTag(containerId, parseInt(e.target.dataset.index));
            });

            container.appendChild(tag);
        });
    }

    removeTag(containerId, index) {
        if (containerId === 'subreddit-tags') {
            this.selectedData.subreddits.splice(index, 1);
            this.updateTagDisplay('subreddit-tags', this.selectedData.subreddits);
        } else if (containerId === 'category-tags') {
            this.selectedData.categories.splice(index, 1);
            this.updateTagDisplay('category-tags', this.selectedData.categories);
            this.validateStep2();
        } else if (containerId === 'subcategory-tags') {
            this.selectedData.subcategories.splice(index, 1);
            this.updateTagDisplay('subcategory-tags', this.selectedData.subcategories);
        }
    }

    validateStep1() {
        const hasDateRange = this.elements.dateStart.value && this.elements.dateEnd.value;
        const isValidRange = hasDateRange &&
            new Date(this.elements.dateStart.value) <= new Date(this.elements.dateEnd.value);

        const hasSubreddit = this.selectedData.subreddits.length > 0;

        if (isValidRange && hasSubreddit) {
            this.selectedData.dateRange = {
                start: this.elements.dateStart.value,
                end: this.elements.dateEnd.value
            };
        }


        this.elements.nextBtn.disabled = !(isValidRange && hasSubreddit);
        this.elements.nextBtn.classList.toggle('active', isValidRange && hasSubreddit);
    }

    validateStep2() {
        const hasCategories = this.selectedData.categories.length > 0;

        this.elements.applyBtn.disabled = !hasCategories;
        this.elements.applyBtn.classList.toggle('active', hasCategories);
    }

    async nextStep() {
        if (this.currentStep < this.maxStep) {
            this.currentStep++;
            this.showStep(this.currentStep);

            if (this.currentStep === 2) {
                await this.loadCategories();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    showStep(stepNumber) {
        document.querySelectorAll('.filter-step').forEach(step => {
            step.style.display = 'none';
        });

        const currentStepElement = document.getElementById(`filter-step-${stepNumber}`);

        if (stepNumber === 1) this.elements.applyBtn.style.display = 'none';
        else this.elements.applyBtn.style.display = 'flex';

        if (currentStepElement) {
            currentStepElement.style.display = 'block';
        }
    }

    resetFilter() {
        this.currentStep = 1;
        this.selectedData = {
            dateRange: { start: this.elements.dateStart.min, end: this.elements.dateEnd.max },
            subreddits: [],
            categories: [],
            subcategories: []
        };

        document.getElementById('subreddit-tags').innerHTML = '';
        document.getElementById('category-tags').innerHTML = '';
        document.getElementById('subcategory-tags').innerHTML = '';

        this.elements.dateStart.value = this.elements.dateStart.min;
        this.elements.dateEnd.value = this.elements.dateEnd.max;

        this.elements.nextBtn.disabled = true;
        this.elements.nextBtn.classList.remove('active');
        this.elements.applyBtn.disabled = true;
        this.elements.applyBtn.classList.remove('active');
    }

    createQuery() {
       return `${this.selectedData.categories.flatMap(c => 'category:' + c.value || c).join(' and ')}
       ${this.selectedData.subcategories.flatMap(sc => 'subCategory:' + sc.value || sc).join(' and ')}
       `.trim();
    }
}
