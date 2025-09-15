/**
 * EPUB Splitter App - Main Application Logic
 */

class EPUBSplitterApp {
    constructor() {
        this.parser = new EPUBParser();
        this.currentFiles = [];
        this.currentEPUB = null;
        this.selectedChapters = new Set();
        this.selectedChunks = new Set();
        this.currentMode = 'chapters'; // 'chapters' or 'chunks'
        this.currentChunks = [];
        this.apiBaseUrl = 'http://localhost:4205/api';
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        this.bindEvents();
        this.showPage('file-list');
        await this.loadFileListFromServer();
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // File list page events
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshFileList();
        });

        // EPUB viewer page events
        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            this.showPage('file-list');
        });

        document.getElementById('select-all-btn').addEventListener('click', () => {
            if (this.currentMode === 'chunks') {
                this.selectAllChunks();
            } else {
                this.selectAllChapters();
            }
        });

        document.getElementById('deselect-all-btn').addEventListener('click', () => {
            if (this.currentMode === 'chunks') {
                this.deselectAllChunks();
            } else {
                this.deselectAllChapters();
            }
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportSelectedChapters();
        });

        // Mode toggle events
        document.getElementById('chapters-mode-btn').addEventListener('click', () => {
            this.switchToMode('chapters');
        });

        document.getElementById('chunks-mode-btn').addEventListener('click', () => {
            this.switchToMode('chunks');
        });

        // Chunks functionality events
        document.getElementById('calculate-chunks-btn').addEventListener('click', () => {
            this.calculateChunks();
        });

        document.getElementById('split-chunks-btn').addEventListener('click', () => {
            this.splitIntoChunks();
        });

        // Export page events
        document.getElementById('back-to-viewer-btn').addEventListener('click', () => {
            this.showPage('epub-viewer');
        });

        document.getElementById('copy-to-clipboard-btn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        // Global error section toggle
        window.toggleErrorSection = () => {
            this.toggleErrorSection();
        };
    }

    /**
     * Load file list from server
     */
    async loadFileListFromServer() {
        try {
            this.showFileListLoading(true);
            const response = await fetch(`${this.apiBaseUrl}/files`);
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentFiles = data.files || [];
            this.displayFileList();
            this.showFileListLoading(false);
            
        } catch (error) {
            this.showError(`Failed to load files from server: ${error.message}`);
            this.showFileListLoading(false);
            this.showNoFilesMessage();
        }
    }

    /**
     * Display the list of EPUB files
     */
    displayFileList() {
        const fileList = document.getElementById('file-list');
        const noFilesMessage = document.getElementById('no-files-message');
        
        if (this.currentFiles.length === 0) {
            this.showNoFilesMessage();
            return;
        }

        noFilesMessage.classList.add('hidden');
        fileList.innerHTML = '';

        this.currentFiles.forEach((file, index) => {
            const fileCard = this.createFileCard(file, index);
            fileList.appendChild(fileCard);
        });
    }

    /**
     * Create a file card element
     */
    createFileCard(file, index) {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.onclick = () => this.openEPUB(file, index);

        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        const lastModified = new Date(file.modified).toLocaleDateString();

        card.innerHTML = `
            <div class="file-icon">📚</div>
            <div class="file-info">
                <h3 class="file-title">${this.escapeHtml(file.name)}</h3>
                <div class="file-meta">
                    <span class="file-size">${sizeInMB} MB</span>
                    <span class="file-date">Modified: ${lastModified}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-small" onclick="event.stopPropagation(); this.parentElement.parentElement.click();">
                    Open
                </button>
            </div>
        `;

        return card;
    }

    /**
     * Open and parse an EPUB file
     */
    async openEPUB(file, index) {
        this.showPage('epub-viewer');
        this.showEPUBLoading(true);
        
        try {
            // Fetch the file from the server
            const response = await fetch(`${this.apiBaseUrl}/files/${encodeURIComponent(file.name)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }
            
            const blob = await response.blob();
            const fileObject = new File([blob], file.name, { type: 'application/epub+zip' });
            
            this.currentEPUB = await this.parser.parseEPUB(fileObject);
            this.selectedChapters.clear();
            
            this.displayEPUBInfo();
            this.displayChapterList();
            
            // Initialize mode to chapters and set up UI
            this.switchToMode('chapters');
            
            this.showEPUBLoading(false);
            
        } catch (error) {
            this.showEPUBError(error.message);
            this.showEPUBLoading(false);
            
            // Add to error list
            this.addFileError(file.filename, error.message);
        }
    }

    /**
     * Display EPUB information
     */
    displayEPUBInfo() {
        document.getElementById('epub-title').textContent = this.currentEPUB.title;
        document.getElementById('epub-book-title').textContent = this.currentEPUB.title;
        document.getElementById('epub-author').textContent = `by ${this.currentEPUB.author}`;
        document.getElementById('epub-chapter-count').textContent = 
            `${this.currentEPUB.chapters.length} chapters`;
        
        document.getElementById('epub-info').classList.remove('hidden');
    }

    /**
     * Display the chapter list with checkboxes
     */
    displayChapterList() {
        const chapterList = document.getElementById('chapter-list');
        chapterList.innerHTML = '';

        if (this.currentEPUB.chapters.length === 0) {
            chapterList.innerHTML = '<p class="no-chapters">No chapters found in this EPUB.</p>';
            return;
        }

        // Sort chapters chronologically by spine order
        const sortedChapters = this.currentEPUB.chapters
            .slice()
            .sort((a, b) => a.spineOrder - b.spineOrder);
        
        sortedChapters.forEach(chapter => {
            this.renderChapter(chapter, chapterList);
        });
    }

    /**
     * Render a chapter in chronological order
     */
    renderChapter(chapter, container) {
        const chapterElement = document.createElement('div');
        chapterElement.className = 'chapter-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `chapter-${chapter.id}`;
        checkbox.addEventListener('change', (e) => {
            this.toggleChapterSelection(chapter.id, e.target.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = `chapter-${chapter.id}`;
        label.className = 'chapter-label';
        
        const title = document.createElement('span');
        title.className = 'chapter-title';
        title.textContent = chapter.title;
        
        const meta = document.createElement('span');
        meta.className = 'chapter-meta';
        const wordCount = chapter.wordCount || this.estimateWordCount(chapter.htmlContent);
        meta.textContent = `${wordCount} words`;

        label.appendChild(title);
        label.appendChild(meta);
        
        chapterElement.appendChild(checkbox);
        chapterElement.appendChild(label);
        
        container.appendChild(chapterElement);
    }

    /**
     * Toggle chapter selection
     */
    toggleChapterSelection(chapterId, selected) {
        if (selected) {
            this.selectedChapters.add(chapterId);
        } else {
            this.selectedChapters.delete(chapterId);
        }
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Select all chapters
     */
    selectAllChapters() {
        this.currentEPUB.chapters.forEach(chapter => {
            this.selectedChapters.add(chapter.id);
            const checkbox = document.getElementById(`chapter-${chapter.id}`);
            if (checkbox) checkbox.checked = true;
        });
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Deselect all chapters
     */
    deselectAllChapters() {
        this.selectedChapters.clear();
        
        this.currentEPUB.chapters.forEach(chapter => {
            const checkbox = document.getElementById(`chapter-${chapter.id}`);
            if (checkbox) checkbox.checked = false;
        });
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Update selection count display
     */
    updateSelectionCount() {
        let count, countText;
        
        if (this.currentMode === 'chunks') {
            count = this.selectedChunks.size;
            countText = count === 1 ? '1 chunk selected' : `${count} chunks selected`;
        } else {
            count = this.selectedChapters.size;
            countText = count === 1 ? '1 chapter selected' : `${count} chapters selected`;
        }
        
        document.getElementById('selection-count').textContent = countText;
    }

    /**
     * Update export button state
     */
    updateExportButton() {
        const exportBtn = document.getElementById('export-btn');
        if (this.currentMode === 'chunks') {
            exportBtn.disabled = this.selectedChunks.size === 0;
        } else {
            exportBtn.disabled = this.selectedChapters.size === 0;
        }
    }

    /**
     * Export selected chapters or chunks
     */
    async exportSelectedChapters() {
        if (this.currentMode === 'chunks') {
            if (this.selectedChunks.size === 0) return;
        } else {
            if (this.selectedChapters.size === 0) return;
        }
        
        this.showPage('export');
        this.showExportLoading(true);
        
        try {
            let selectedItems, exportContent;
            
            if (this.currentMode === 'chunks') {
                selectedItems = this.currentChunks
                    .filter(chunk => this.selectedChunks.has(chunk.id))
                    .sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]));
                
                this.displayExportInfo(selectedItems.length, 'chunks');
                exportContent = this.generateExportContentFromChunks(selectedItems);
            } else {
                selectedItems = this.currentEPUB.chapters
                    .filter(ch => this.selectedChapters.has(ch.id))
                    .sort((a, b) => a.spineOrder - b.spineOrder);
                
                this.displayExportInfo(selectedItems.length, 'chapters');
                exportContent = this.generateExportContent(selectedItems);
            }
            
            this.displayExportContent(exportContent);
            this.showExportLoading(false);
            
        } catch (error) {
            this.showError(`Export failed: ${error.message}`);
            this.showExportLoading(false);
        }
    }

    /**
     * Generate export content from selected chapters
     */
    generateExportContent(chapters) {
        let content = `<div class="export-document">`;
        content += `<h1 class="export-title">${this.escapeHtml(this.currentEPUB.title)}</h1>`;
        content += `<p class="export-author">by ${this.escapeHtml(this.currentEPUB.author)}</p>`;
        content += `<hr class="export-separator">`;
        
        chapters.forEach((chapter, index) => {
            content += `<div class="export-chapter">`;
            content += `<h2 class="export-chapter-title">${this.escapeHtml(chapter.title)}</h2>`;
            content += `<div class="export-chapter-content">`;
            content += chapter.htmlContent || '';
            content += `</div></div>`;
        });
        
        content += `</div>`;
        return content;
    }

    /**
     * Generate export content from selected chunks
     */
    generateExportContentFromChunks(chunks) {
        let content = `<div class="export-document">`;
        content += `<h1 class="export-title">${this.escapeHtml(this.currentEPUB.title)}</h1>`;
        content += `<p class="export-author">by ${this.escapeHtml(this.currentEPUB.author)}</p>`;
        content += `<hr class="export-separator">`;
        
        chunks.forEach((chunk, index) => {
            content += `<div class="export-chapter">`;
            content += `<h2 class="export-chapter-title">${this.escapeHtml(chunk.title)}</h2>`;
            content += `<div class="export-chapter-content">`;
            content += chunk.htmlContent || '';
            content += `</div></div>`;
        });
        
        content += `</div>`;
        return content;
    }

    /**
     * Display export information
     */
    displayExportInfo(itemCount, mode = 'chapters') {
        const itemType = mode === 'chunks' ? 'chunks' : 'chapters';
        const summary = `Exporting ${itemCount} ${itemType} from`;
        document.getElementById('export-summary').innerHTML = 
            `${summary} <span id="export-book-title">${this.escapeHtml(this.currentEPUB.title)}</span>`;
    }

    /**
     * Display export content
     */
    displayExportContent(content) {
        document.getElementById('export-content').innerHTML = content;
    }

    /**
     * Copy content to clipboard
     */
    async copyToClipboard() {
        try {
            const exportContent = document.getElementById('export-content');
            const plainText = this.parser.htmlToPlainText(exportContent.innerHTML);
            
            await navigator.clipboard.writeText(plainText);
            this.showCopySuccess();
            
        } catch (error) {
            // Fallback for older browsers
            this.fallbackCopyToClipboard();
        }
    }

    /**
     * Fallback copy method for older browsers
     */
    fallbackCopyToClipboard() {
        const exportContent = document.getElementById('export-content');
        const plainText = this.parser.htmlToPlainText(exportContent.innerHTML);
        
        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopySuccess();
        } catch (error) {
            this.showError('Failed to copy to clipboard. Please select and copy manually.');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    /**
     * Show copy success message
     */
    showCopySuccess() {
        const successElement = document.getElementById('copy-success');
        successElement.classList.remove('hidden');
        
        setTimeout(() => {
            successElement.classList.add('hidden');
        }, 3000);
    }

    /**
     * Show/hide pages
     */
    showPage(pageId) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        
        document.getElementById(`${pageId}-page`).classList.add('active');
        this.currentPage = pageId;
    }

    /**
     * Show/hide loading indicators
     */
    showEPUBLoading(show) {
        const loading = document.getElementById('epub-loading');
        const info = document.getElementById('epub-info');
        const chapterList = document.getElementById('chapter-list');
        const error = document.getElementById('epub-error');
        
        if (show) {
            loading.classList.remove('hidden');
            info.classList.add('hidden');
            chapterList.innerHTML = '';
            error.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showExportLoading(show) {
        const loading = document.getElementById('export-loading');
        const content = document.getElementById('export-content');
        
        if (show) {
            loading.classList.remove('hidden');
            content.innerHTML = '';
        } else {
            loading.classList.add('hidden');
        }
    }

    showFileListLoading(show) {
        const loading = document.getElementById('file-list-loading');
        const fileList = document.getElementById('file-list');
        const noFilesMessage = document.getElementById('no-files-message');
        
        if (show) {
            if (loading) loading.classList.remove('hidden');
            noFilesMessage.classList.add('hidden');
            fileList.innerHTML = '';
        } else {
            if (loading) loading.classList.add('hidden');
        }
    }

    /**
     * Show EPUB parsing error
     */
    showEPUBError(message) {
        document.getElementById('epub-error-message').textContent = message;
        document.getElementById('epub-error').classList.remove('hidden');
        document.getElementById('epub-info').classList.add('hidden');
    }

    /**
     * Show no files message
     */
    showNoFilesMessage() {
        document.getElementById('no-files-message').classList.remove('hidden');
        document.getElementById('file-list').innerHTML = '';
    }

    /**
     * Add file error to error section
     */
    addFileError(filename, error) {
        const errorSection = document.getElementById('error-section');
        const errorList = document.getElementById('error-list');
        const errorCount = document.getElementById('error-count');
        
        const errorItem = document.createElement('div');
        errorItem.className = 'error-item';
        errorItem.innerHTML = `
            <div class="error-file">${this.escapeHtml(filename)}</div>
            <div class="error-message">${this.escapeHtml(error)}</div>
        `;
        
        errorList.appendChild(errorItem);
        
        const currentCount = parseInt(errorCount.textContent) + 1;
        errorCount.textContent = currentCount;
        
        errorSection.classList.remove('hidden');
    }

    /**
     * Toggle error section visibility
     */
    toggleErrorSection() {
        const errorList = document.getElementById('error-list');
        const toggle = document.getElementById('error-toggle');
        
        if (errorList.classList.contains('collapsed')) {
            errorList.classList.remove('collapsed');
            toggle.textContent = '▼';
        } else {
            errorList.classList.add('collapsed');
            toggle.textContent = '▶';
        }
    }

    /**
     * Refresh file list
     */
    async refreshFileList() {
        await this.loadFileListFromServer();
    }

    /**
     * Show error message
     */
    showError(message) {
        alert(message); // Simple error display - could be enhanced with a modal
    }

    /**
     * Estimate word count from HTML content
     */
    estimateWordCount(html) {
        const text = this.parser.htmlToPlainText(html);
        const words = text.split(/\s+/).filter(word => word.length > 0);
        return words.length;
    }

    /**
     * Switch between chapters and chunks modes
     */
    switchToMode(mode) {
        this.currentMode = mode;
        
        // Update toggle buttons
        document.getElementById('chapters-mode-btn').classList.toggle('active', mode === 'chapters');
        document.getElementById('chunks-mode-btn').classList.toggle('active', mode === 'chunks');
        
        // Show/hide appropriate views
        document.getElementById('chapters-view').classList.toggle('active', mode === 'chapters');
        document.getElementById('chapters-view').classList.toggle('hidden', mode !== 'chapters');
        document.getElementById('chunks-view').classList.toggle('active', mode === 'chunks');
        document.getElementById('chunks-view').classList.toggle('hidden', mode !== 'chunks');
        
        // Update selection count and export button
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Calculate chunk preview based on user input
     */
    calculateChunks() {
        if (!this.currentEPUB) return;
        
        const chunkCount = parseInt(document.getElementById('chunk-count').value);
        if (isNaN(chunkCount) || chunkCount < 2) {
            alert('Please enter a valid number of chunks (minimum 2)');
            return;
        }
        
        // Calculate total words from all chapters
        const totalWords = this.currentEPUB.chapters.reduce((sum, chapter) => {
            return sum + (chapter.wordCount || 0);
        }, 0);
        
        const targetWordsPerChunk = Math.floor(totalWords / chunkCount);
        const tolerance = Math.floor(targetWordsPerChunk * 0.1); // 10% tolerance
        const minWords = targetWordsPerChunk - tolerance;
        const maxWords = targetWordsPerChunk + tolerance;
        
        // Update preview display
        document.getElementById('total-words').textContent = totalWords.toLocaleString();
        document.getElementById('target-words-per-chunk').textContent = targetWordsPerChunk.toLocaleString();
        document.getElementById('chunk-word-range').textContent = `${minWords.toLocaleString()}-${maxWords.toLocaleString()}`;
        
        // Show preview section
        document.getElementById('chunk-preview').classList.remove('hidden');
    }

    /**
     * Split the book content into intelligent chunks
     */
    async splitIntoChunks() {
        if (!this.currentEPUB) return;
        
        const chunkCount = parseInt(document.getElementById('chunk-count').value);
        const totalWords = this.currentEPUB.chapters.reduce((sum, chapter) => {
            return sum + (chapter.wordCount || 0);
        }, 0);
        
        const targetWordsPerChunk = Math.floor(totalWords / chunkCount);
        const tolerance = Math.floor(targetWordsPerChunk * 0.1);
        
        // Combine all chapter content into one continuous text
        const fullContent = this.currentEPUB.chapters
            .sort((a, b) => a.spineOrder - b.spineOrder)
            .map(chapter => ({
                title: chapter.title,
                textContent: chapter.textContent || '',
                htmlContent: chapter.htmlContent || ''
            }));
        
        // Create intelligent chunks
        this.currentChunks = this.createIntelligentChunks(
            fullContent, 
            chunkCount, 
            targetWordsPerChunk, 
            tolerance
        );
        
        // Display chunks
        this.displayChunks();
        
        // Update selection tracking
        this.selectedChunks.clear();
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Create intelligent chunks with optimal break points using recursive refinement
     */
    createIntelligentChunks(content, chunkCount, targetWords, tolerance) {
        // Combine all content into one continuous text with chapter boundaries marked
        const fullText = this.combineContentWithMarkers(content);
        const totalWords = this.countWords(fullText.text);
        
        // Initial rough split into desired number of chunks
        let chunks = this.initialChunkSplit(fullText, chunkCount, targetWords);
        
        // Recursive refinement to achieve exact count and tolerance
        chunks = this.refineChunksRecursively(chunks, chunkCount, targetWords, tolerance, 0, 5);
        
        // Final cleanup and formatting
        return this.formatFinalChunks(chunks, content);
    }

    /**
     * Combine content with chapter boundary markers
     */
    combineContentWithMarkers(content) {
        let combinedText = '';
        let combinedHtml = '';
        const chapterMarkers = [];
        let currentPosition = 0;
        
        content.forEach((chapter, index) => {
            const chapterText = chapter.textContent || '';
            const chapterHtml = chapter.htmlContent || '';
            
            chapterMarkers.push({
                title: chapter.title,
                startPosition: currentPosition,
                endPosition: currentPosition + this.countWords(chapterText),
                textContent: chapterText,
                htmlContent: chapterHtml
            });
            
            combinedText += chapterText + '\n\n';
            combinedHtml += chapterHtml + '\n\n';
            currentPosition += this.countWords(chapterText);
        });
        
        return {
            text: combinedText,
            html: combinedHtml,
            totalWords: currentPosition,
            chapterMarkers
        };
    }

    /**
     * Initial rough split into chunks
     */
    initialChunkSplit(fullText, chunkCount, targetWords) {
        const words = fullText.text.split(/\s+/).filter(w => w.length > 0);
        const chunks = [];
        const wordsPerChunk = Math.floor(words.length / chunkCount);
        
        for (let i = 0; i < chunkCount; i++) {
            const startIndex = i * wordsPerChunk;
            const endIndex = i === chunkCount - 1 ? words.length : (i + 1) * wordsPerChunk;
            
            const chunkWords = words.slice(startIndex, endIndex);
            chunks.push({
                id: `chunk-${i + 1}`,
                title: `Chunk ${i + 1}`,
                words: chunkWords,
                wordCount: chunkWords.length,
                startWordIndex: startIndex,
                endWordIndex: endIndex
            });
        }
        
        return chunks;
    }

    /**
     * Recursively refine chunks to meet tolerance requirements
     */
    refineChunksRecursively(chunks, targetCount, targetWords, tolerance, iteration, maxIterations) {
        if (iteration >= maxIterations) {
            return chunks;
        }
        
        const minWords = targetWords - tolerance;
        const maxWords = targetWords + tolerance;
        let needsRefinement = false;
        
        // Check if any chunks are outside tolerance
        for (const chunk of chunks) {
            if (chunk.wordCount < minWords || chunk.wordCount > maxWords) {
                needsRefinement = true;
                break;
            }
        }
        
        // Check if we have the right number of chunks
        if (chunks.length !== targetCount) {
            needsRefinement = true;
        }
        
        if (!needsRefinement) {
            return chunks;
        }
        
        // Perform refinement
        const refinedChunks = this.performChunkRefinement(chunks, targetCount, targetWords, tolerance);
        
        // Recursive call
        return this.refineChunksRecursively(refinedChunks, targetCount, targetWords, tolerance, iteration + 1, maxIterations);
    }

    /**
     * Perform one iteration of chunk refinement
     */
    performChunkRefinement(chunks, targetCount, targetWords, tolerance) {
        const minWords = targetWords - tolerance;
        const maxWords = targetWords + tolerance;
        const refinedChunks = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            if (chunk.wordCount > maxWords) {
                // Split oversized chunk
                const splitPoint = this.findOptimalSplitPoint(chunk.words, Math.floor(chunk.words.length / 2));
                
                const firstPart = {
                    id: `chunk-${refinedChunks.length + 1}`,
                    title: `Chunk ${refinedChunks.length + 1}`,
                    words: chunk.words.slice(0, splitPoint),
                    wordCount: splitPoint,
                    startWordIndex: chunk.startWordIndex,
                    endWordIndex: chunk.startWordIndex + splitPoint
                };
                
                const secondPart = {
                    id: `chunk-${refinedChunks.length + 2}`,
                    title: `Chunk ${refinedChunks.length + 2}`,
                    words: chunk.words.slice(splitPoint),
                    wordCount: chunk.words.length - splitPoint,
                    startWordIndex: chunk.startWordIndex + splitPoint,
                    endWordIndex: chunk.endWordIndex
                };
                
                refinedChunks.push(firstPart, secondPart);
                
            } else if (chunk.wordCount < minWords && i < chunks.length - 1) {
                // Try to merge with next chunk
                const nextChunk = chunks[i + 1];
                const combinedWordCount = chunk.wordCount + nextChunk.wordCount;
                
                if (combinedWordCount <= maxWords * 1.2) { // Allow some flexibility for merging
                    const mergedChunk = {
                        id: `chunk-${refinedChunks.length + 1}`,
                        title: `Chunk ${refinedChunks.length + 1}`,
                        words: [...chunk.words, ...nextChunk.words],
                        wordCount: combinedWordCount,
                        startWordIndex: chunk.startWordIndex,
                        endWordIndex: nextChunk.endWordIndex
                    };
                    
                    refinedChunks.push(mergedChunk);
                    i++; // Skip next chunk as it's been merged
                } else {
                    refinedChunks.push(chunk);
                }
            } else {
                refinedChunks.push(chunk);
            }
        }
        
        // If we have too many chunks, merge the smallest ones
        while (refinedChunks.length > targetCount) {
            let smallestIndex = 0;
            for (let i = 1; i < refinedChunks.length - 1; i++) {
                if (refinedChunks[i].wordCount < refinedChunks[smallestIndex].wordCount) {
                    smallestIndex = i;
                }
            }
            
            // Merge with adjacent chunk
            const targetIndex = smallestIndex === 0 ? 1 : smallestIndex - 1;
            const merged = {
                id: `chunk-${targetIndex + 1}`,
                title: `Chunk ${targetIndex + 1}`,
                words: [...refinedChunks[Math.min(smallestIndex, targetIndex)].words, 
                       ...refinedChunks[Math.max(smallestIndex, targetIndex)].words],
                wordCount: refinedChunks[smallestIndex].wordCount + refinedChunks[targetIndex].wordCount,
                startWordIndex: Math.min(refinedChunks[smallestIndex].startWordIndex, refinedChunks[targetIndex].startWordIndex),
                endWordIndex: Math.max(refinedChunks[smallestIndex].endWordIndex, refinedChunks[targetIndex].endWordIndex)
            };
            
            refinedChunks.splice(Math.max(smallestIndex, targetIndex), 1);
            refinedChunks.splice(Math.min(smallestIndex, targetIndex), 1, merged);
        }
        
        // If we have too few chunks, split the largest one
        while (refinedChunks.length < targetCount) {
            let largestIndex = 0;
            for (let i = 1; i < refinedChunks.length; i++) {
                if (refinedChunks[i].wordCount > refinedChunks[largestIndex].wordCount) {
                    largestIndex = i;
                }
            }
            
            const chunk = refinedChunks[largestIndex];
            const splitPoint = this.findOptimalSplitPoint(chunk.words, Math.floor(chunk.words.length / 2));
            
            const firstPart = {
                id: `chunk-${largestIndex + 1}`,
                title: `Chunk ${largestIndex + 1}`,
                words: chunk.words.slice(0, splitPoint),
                wordCount: splitPoint,
                startWordIndex: chunk.startWordIndex,
                endWordIndex: chunk.startWordIndex + splitPoint
            };
            
            const secondPart = {
                id: `chunk-${largestIndex + 2}`,
                title: `Chunk ${largestIndex + 2}`,
                words: chunk.words.slice(splitPoint),
                wordCount: chunk.words.length - splitPoint,
                startWordIndex: chunk.startWordIndex + splitPoint,
                endWordIndex: chunk.endWordIndex
            };
            
            refinedChunks.splice(largestIndex, 1, firstPart, secondPart);
        }
        
        // Renumber chunks
        refinedChunks.forEach((chunk, index) => {
            chunk.id = `chunk-${index + 1}`;
            chunk.title = `Chunk ${index + 1}`;
        });
        
        return refinedChunks;
    }

    /**
     * Find optimal split point in words array
     */
    findOptimalSplitPoint(words, targetSplit) {
        const searchRange = Math.min(50, Math.floor(words.length * 0.1)); // Search within 10% or 50 words
        const minSplit = Math.max(1, targetSplit - searchRange);
        const maxSplit = Math.min(words.length - 1, targetSplit + searchRange);
        
        let bestSplit = targetSplit;
        let bestScore = this.calculateBreakPointScore(words, targetSplit);
        
        for (let i = minSplit; i <= maxSplit; i++) {
            const score = this.calculateBreakPointScore(words, i);
            if (score > bestScore) {
                bestScore = score;
                bestSplit = i;
            }
        }
        
        return bestSplit;
    }

    /**
     * Format final chunks with chapter information
     */
    formatFinalChunks(chunks, originalContent) {
        return chunks.map(chunk => {
            const textContent = chunk.words.join(' ');
            
            // Find which chapters this chunk spans
            const startChapter = this.findChapterAtPosition(chunk.startWordIndex, originalContent);
            const endChapter = this.findChapterAtPosition(chunk.endWordIndex - 1, originalContent);
            
            // Generate HTML content (simplified - could be enhanced)
            const htmlContent = `<div class="chunk-content">${this.escapeHtml(textContent)}</div>`;
            
            return {
                id: chunk.id,
                title: chunk.title,
                textContent: textContent,
                htmlContent: htmlContent,
                wordCount: chunk.wordCount,
                startChapter: startChapter?.title || 'Unknown',
                endChapter: endChapter?.title || 'Unknown'
            };
        });
    }

    /**
     * Find chapter at specific word position
     */
    findChapterAtPosition(wordPosition, originalContent) {
        let currentPosition = 0;
        
        for (const chapter of originalContent) {
            const chapterWordCount = this.countWords(chapter.textContent || '');
            if (wordPosition >= currentPosition && wordPosition < currentPosition + chapterWordCount) {
                return chapter;
            }
            currentPosition += chapterWordCount;
        }
        
        return originalContent[originalContent.length - 1]; // Return last chapter as fallback
    }

    /**
     * Calculate break point score for intelligent splitting (word-based)
     */
    calculateBreakPointScore(words, splitIndex) {
        if (splitIndex <= 0 || splitIndex >= words.length) {
            return 0;
        }
        
        let score = 0;
        const beforeWord = words[splitIndex - 1] || '';
        const afterWord = words[splitIndex] || '';
        
        // Prefer sentence endings
        if (beforeWord.match(/[.!?]$/)) {
            score += 100;
        }
        
        // Prefer paragraph breaks (words ending with double newlines)
        if (beforeWord.includes('\n\n') || afterWord.includes('\n\n')) {
            score += 80;
        }
        
        // Prefer after punctuation
        if (beforeWord.match(/[.!?;:]$/)) {
            score += 60;
        }
        
        // Prefer before capital letters (new sentences)
        if (afterWord && afterWord[0] && afterWord[0] === afterWord[0].toUpperCase() && afterWord[0].match(/[A-Z]/)) {
            score += 40;
        }
        
        // Prefer chapter or section breaks
        if (beforeWord.toLowerCase().includes('chapter') || afterWord.toLowerCase().includes('chapter')) {
            score += 90;
        }
        
        // Prefer breaks at common transition words
        const transitionWords = ['however', 'therefore', 'meanwhile', 'furthermore', 'moreover', 'consequently'];
        if (transitionWords.some(word => afterWord.toLowerCase().startsWith(word))) {
            score += 30;
        }
        
        return score;
    }


    /**
     * Display chunks in the UI
     */
    displayChunks() {
        const chunkList = document.getElementById('chunk-list');
        chunkList.innerHTML = '';
        
        this.currentChunks.forEach(chunk => {
            this.renderChunk(chunk, chunkList);
        });
    }

    /**
     * Render a single chunk
     */
    renderChunk(chunk, container) {
        const chunkElement = document.createElement('div');
        chunkElement.className = 'chunk-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `chunk-${chunk.id}`;
        checkbox.addEventListener('change', (e) => {
            this.toggleChunkSelection(chunk.id, e.target.checked);
        });

        const chunkHeader = document.createElement('div');
        chunkHeader.className = 'chunk-header';
        
        const label = document.createElement('label');
        label.htmlFor = `chunk-${chunk.id}`;
        label.className = 'chunk-title';
        label.textContent = chunk.title;
        
        const meta = document.createElement('span');
        meta.className = 'chunk-meta';
        meta.textContent = `${chunk.wordCount} words`;
        
        chunkHeader.appendChild(label);
        chunkHeader.appendChild(meta);
        
        const preview = document.createElement('div');
        preview.className = 'chunk-preview-text';
        const previewText = chunk.textContent.substring(0, 200) + (chunk.textContent.length > 200 ? '...' : '');
        preview.textContent = previewText;
        
        const chapterRange = document.createElement('div');
        chapterRange.className = 'chunk-meta';
        chapterRange.style.marginTop = '0.5rem';
        chapterRange.textContent = chunk.startChapter === chunk.endChapter 
            ? `From: ${chunk.startChapter}`
            : `From: ${chunk.startChapter} to ${chunk.endChapter}`;
        
        chunkElement.appendChild(checkbox);
        chunkElement.appendChild(chunkHeader);
        chunkElement.appendChild(preview);
        chunkElement.appendChild(chapterRange);
        
        container.appendChild(chunkElement);
    }

    /**
     * Toggle chunk selection
     */
    toggleChunkSelection(chunkId, selected) {
        if (selected) {
            this.selectedChunks.add(chunkId);
        } else {
            this.selectedChunks.delete(chunkId);
        }
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Count words in text
     */
    countWords(text) {
        if (!text) return 0;
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Select all chunks
     */
    selectAllChunks() {
        this.currentChunks.forEach(chunk => {
            this.selectedChunks.add(chunk.id);
            const checkbox = document.getElementById(`chunk-${chunk.id}`);
            if (checkbox) checkbox.checked = true;
        });
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Deselect all chunks
     */
    deselectAllChunks() {
        this.currentChunks.forEach(chunk => {
            this.selectedChunks.delete(chunk.id);
            const checkbox = document.getElementById(`chunk-${chunk.id}`);
            if (checkbox) checkbox.checked = false;
        });
        
        this.updateSelectionCount();
        this.updateExportButton();
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.epubSplitterApp = new EPUBSplitterApp();
});
