/**
 * EPUB Parser - Handles EPUB file parsing and content extraction
 */

class EPUBParser {
    constructor() {
        this.supportedMimeTypes = [
            'application/epub+zip',
            'application/zip'
        ];
    }

    /**
     * Parse an EPUB file from a File object
     * @param {File} file - The EPUB file
     * @returns {Promise<Object>} - Parsed EPUB object
     */
    async parseEPUB(file) {
        try {
            const epub = {
                filename: file.name,
                title: '',
                author: '',
                chapters: [],
                errors: []
            };

            // Load the ZIP file
            const zip = await JSZip.loadAsync(file);
            
            // Find and parse container.xml
            const containerPath = 'META-INF/container.xml';
            if (!zip.files[containerPath]) {
                throw new Error('Missing META-INF/container.xml - not a valid EPUB');
            }

            const containerXml = await zip.files[containerPath].async('text');
            const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
            
            // Get the OPF file path
            const rootfileElement = containerDoc.querySelector('rootfile');
            if (!rootfileElement) {
                throw new Error('No rootfile found in container.xml');
            }

            const opfPath = rootfileElement.getAttribute('full-path');
            if (!zip.files[opfPath]) {
                throw new Error(`OPF file not found: ${opfPath}`);
            }

            // Parse the OPF file
            const opfXml = await zip.files[opfPath].async('text');
            const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');

            // Extract metadata
            epub.title = this.getTextContent(opfDoc.querySelector('metadata title')) || 'Unknown Title';
            epub.author = this.getTextContent(opfDoc.querySelector('metadata creator')) || 'Unknown Author';

            // Get the base path for resolving relative paths
            const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

            // Parse manifest and spine
            const manifest = this.parseManifest(opfDoc, basePath);
            const spine = this.parseSpine(opfDoc);

            // Try to parse navigation (EPUB3 nav.xhtml or EPUB2 toc.ncx)
            let navigation = null;
            try {
                navigation = await this.parseNavigation(zip, manifest, basePath);
            } catch (navError) {
                epub.errors.push(`Navigation parsing failed: ${navError.message}`);
            }

            // Extract chapters
            epub.chapters = await this.extractChapters(zip, manifest, spine, navigation, basePath);

            return epub;

        } catch (error) {
            throw new Error(`EPUB parsing failed: ${error.message}`);
        }
    }

    /**
     * Parse the manifest from OPF
     */
    parseManifest(opfDoc, basePath) {
        const manifest = {};
        const items = opfDoc.querySelectorAll('manifest item');
        
        items.forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            
            if (id && href) {
                manifest[id] = {
                    href: basePath + href,
                    mediaType: mediaType || '',
                    properties: item.getAttribute('properties') || ''
                };
            }
        });

        return manifest;
    }

    /**
     * Parse the spine from OPF
     */
    parseSpine(opfDoc) {
        const spine = [];
        const itemrefs = opfDoc.querySelectorAll('spine itemref');
        
        itemrefs.forEach((itemref, index) => {
            const idref = itemref.getAttribute('idref');
            if (idref) {
                spine.push({
                    idref: idref,
                    order: index,
                    linear: itemref.getAttribute('linear') !== 'no'
                });
            }
        });

        return spine;
    }

    /**
     * Parse navigation (EPUB3 nav.xhtml or EPUB2 toc.ncx)
     */
    async parseNavigation(zip, manifest, basePath) {
        // Try EPUB3 navigation first
        const navItem = Object.values(manifest).find(item => 
            item.properties && item.properties.includes('nav')
        );

        if (navItem && zip.files[navItem.href]) {
            return await this.parseEPUB3Navigation(zip, navItem.href);
        }

        // Fallback to EPUB2 NCX
        const ncxItem = Object.values(manifest).find(item => 
            item.mediaType === 'application/x-dtbncx+xml'
        );

        if (ncxItem && zip.files[ncxItem.href]) {
            return await this.parseEPUB2Navigation(zip, ncxItem.href);
        }

        return null;
    }

    /**
     * Parse EPUB3 navigation document
     */
    async parseEPUB3Navigation(zip, navPath) {
        const navXml = await zip.files[navPath].async('text');
        const navDoc = new DOMParser().parseFromString(navXml, 'text/xml');
        
        const tocNav = navDoc.querySelector('nav[epub\\:type="toc"], nav[*|type="toc"]');
        if (!tocNav) {
            throw new Error('No TOC navigation found in nav document');
        }

        return this.parseNavigationList(tocNav.querySelector('ol'));
    }

    /**
     * Parse EPUB2 NCX navigation
     */
    async parseEPUB2Navigation(zip, ncxPath) {
        const ncxXml = await zip.files[ncxPath].async('text');
        const ncxDoc = new DOMParser().parseFromString(ncxXml, 'text/xml');
        
        const navMap = ncxDoc.querySelector('navMap');
        if (!navMap) {
            throw new Error('No navMap found in NCX file');
        }

        return this.parseNCXNavPoints(navMap.querySelectorAll('navPoint'));
    }

    /**
     * Parse navigation list (EPUB3) - flattened
     */
    parseNavigationList(ol, parentId = null, items = [], depth = 0) {
        if (!ol) return items;

        const listItems = ol.querySelectorAll(':scope > li');

        listItems.forEach((li, index) => {
            const link = li.querySelector('a');
            if (!link) return;

            const href = link.getAttribute('href');
            const title = link.textContent.trim();
            const id = `nav-${parentId || 'root'}-${index}-${depth}`;

            const item = {
                id: id,
                title: title || 'Untitled',
                href: href ? href.split('#')[0] : '', // Remove fragment
                parentId: null, // Remove parent relationship
                children: [] // Keep empty for compatibility
            };

            items.push(item);

            // Process nested lists but flatten them
            const nestedOl = li.querySelector('ol');
            if (nestedOl) {
                this.parseNavigationList(nestedOl, id, items, depth + 1);
            }
        });

        return items;
    }

    /**
     * Parse NCX navigation points (EPUB2) - flattened
     */
    parseNCXNavPoints(navPoints, parentId = null, items = [], depth = 0) {
        navPoints.forEach((navPoint, index) => {
            const navLabel = navPoint.querySelector('navLabel text');
            const content = navPoint.querySelector('content');
            
            if (!navLabel || !content) return;

            const title = navLabel.textContent.trim();
            const href = content.getAttribute('src');
            const id = `ncx-${parentId || 'root'}-${index}-${depth}`;

            const item = {
                id: id,
                title: title || 'Untitled',
                href: href ? href.split('#')[0] : '', // Remove fragment
                parentId: null, // Remove parent relationship
                children: [] // Keep empty for compatibility
            };

            items.push(item);

            // Process nested navPoints but flatten them
            const nestedNavPoints = navPoint.querySelectorAll(':scope > navPoint');
            if (nestedNavPoints.length > 0) {
                this.parseNCXNavPoints(nestedNavPoints, id, items, depth + 1);
            }
        });

        return items;
    }

    /**
     * Extract chapters from EPUB
     */
    async extractChapters(zip, manifest, spine, navigation, basePath) {
        const chapters = [];
        
        if (navigation && navigation.length > 0) {
            // Use navigation structure
            await this.extractChaptersFromNavigation(zip, manifest, navigation, chapters);
        } else {
            // Fallback to spine order
            await this.extractChaptersFromSpine(zip, manifest, spine, chapters);
        }

        return chapters;
    }

    /**
     * Extract chapters using navigation structure - flattened
     */
    async extractChaptersFromNavigation(zip, manifest, navigation, chapters) {
        const processedFiles = new Set(); // Track processed files to avoid duplicates
        
        for (const navItem of navigation) {
            try {
                // Find the manifest item for this navigation entry
                const manifestItem = Object.values(manifest).find(item => 
                    item.href.endsWith(navItem.href) || 
                    item.href.includes(navItem.href.split('#')[0])
                );

                if (manifestItem && zip.files[manifestItem.href]) {
                    const fileKey = `${manifestItem.href}#${navItem.href}`;
                    
                    // Skip if we've already processed this exact file+fragment combination
                    if (processedFiles.has(fileKey)) {
                        continue;
                    }
                    processedFiles.add(fileKey);
                    
                    let htmlContent = await this.extractHTMLContent(zip, manifestItem.href);
                    
                    // If navigation points to a specific fragment, try to extract that section
                    if (navItem.href.includes('#')) {
                        const fragmentId = navItem.href.split('#')[1];
                        htmlContent = this.extractFragmentContent(htmlContent, fragmentId) || htmlContent;
                    }
                    
                    const textContent = this.extractTextContent(htmlContent);
                    const wordCount = this.countWords(textContent);
                    
                    // Only include chapters with meaningful content
                    if (wordCount > 10) {
                        const chapter = {
                            id: navItem.id,
                            title: navItem.title,
                            htmlContent: htmlContent,
                            textContent: textContent,
                            wordCount: wordCount,
                            spineOrder: this.findSpineOrder(manifest, manifestItem.href),
                            parentId: null, // Remove parent relationship
                            children: [] // Keep empty for compatibility
                        };

                        chapters.push(chapter);
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract chapter ${navItem.title}:`, error);
            }
        }
    }

    /**
     * Extract content for a specific fragment/section
     */
    extractFragmentContent(htmlContent, fragmentId) {
        if (!fragmentId || !htmlContent) return htmlContent;
        
        const div = document.createElement('div');
        div.innerHTML = htmlContent;
        
        // Try to find the element with the fragment ID
        const targetElement = div.querySelector(`#${fragmentId}`);
        if (targetElement) {
            // Extract content from this element to the next heading or section
            const content = [];
            let currentElement = targetElement;
            
            // Include the target element itself
            content.push(currentElement.outerHTML);
            
            // Include following siblings until we hit another major section
            let sibling = currentElement.nextElementSibling;
            while (sibling) {
                const tagName = sibling.tagName.toLowerCase();
                
                // Stop if we hit another major heading or section
                if (['h1', 'h2', 'h3', 'section', 'chapter'].includes(tagName) && 
                    sibling.id && sibling.id !== fragmentId) {
                    break;
                }
                
                content.push(sibling.outerHTML);
                sibling = sibling.nextElementSibling;
            }
            
            return content.join('');
        }
        
        return htmlContent;
    }

    /**
     * Extract chapters using spine order (fallback)
     */
    async extractChaptersFromSpine(zip, manifest, spine, chapters) {
        for (let i = 0; i < spine.length; i++) {
            const spineItem = spine[i];
            const manifestItem = manifest[spineItem.idref];
            
            if (!manifestItem || !zip.files[manifestItem.href]) continue;

            try {
                const htmlContent = await this.extractHTMLContent(zip, manifestItem.href);
                const textContent = this.extractTextContent(htmlContent);
                const wordCount = this.countWords(textContent);
                const filename = manifestItem.href.split('/').pop();
                
                const chapter = {
                    id: `spine-${i}`,
                    title: `Chapter ${i + 1} (${filename})`,
                    htmlContent: htmlContent,
                    textContent: textContent,
                    wordCount: wordCount,
                    spineOrder: i,
                    parentId: null,
                    children: []
                };

                chapters.push(chapter);
            } catch (error) {
                console.warn(`Failed to extract spine item ${spineItem.idref}:`, error);
            }
        }
    }

    /**
     * Extract and clean HTML content
     */
    async extractHTMLContent(zip, filePath) {
        const htmlText = await zip.files[filePath].async('text');
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        
        // Remove unwanted elements
        const unwantedSelectors = [
            'script', 'style', 'link', 'meta', 'title',
            'img', 'svg', 'video', 'audio', 'object', 'embed',
            'nav', 'header', 'footer', '.navigation', '#navigation'
        ];
        
        unwantedSelectors.forEach(selector => {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // Get the body content or fall back to the whole document
        const body = doc.querySelector('body');
        const content = body || doc.documentElement;
        
        return content.innerHTML || '';
    }

    /**
     * Extract clean text content from HTML
     */
    extractTextContent(html) {
        if (!html || html.trim() === '') return '';
        
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Remove any remaining unwanted elements
        const unwantedSelectors = [
            'script', 'style', 'nav', 'header', 'footer',
            '.navigation', '#navigation', '.toc', '#toc'
        ];
        
        unwantedSelectors.forEach(selector => {
            const elements = div.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // Replace block elements with line breaks for better text extraction
        const blockElements = div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, br, li');
        blockElements.forEach(el => {
            if (el.tagName === 'BR') {
                el.replaceWith('\n');
            } else if (el.tagName === 'LI') {
                el.insertAdjacentText('beforebegin', '• ');
                el.insertAdjacentText('afterend', '\n');
            } else {
                el.insertAdjacentText('afterend', '\n\n');
            }
        });
        
        // Get clean text and normalize whitespace
        let text = div.textContent || div.innerText || '';
        
        // Clean up whitespace
        text = text
            .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
            .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
            .trim();
            
        return text;
    }

    /**
     * Count words in text content
     */
    countWords(text) {
        if (!text || text.trim() === '') return 0;
        
        // Split by whitespace and filter out empty strings
        const words = text
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0 && /\w/.test(word));
            
        return words.length;
    }

    /**
     * Find spine order for a given href
     */
    findSpineOrder(manifest, href) {
        const manifestEntry = Object.entries(manifest).find(([id, item]) => 
            item.href === href
        );
        
        return manifestEntry ? parseInt(manifestEntry[0].replace(/\D/g, '')) || 0 : 999;
    }

    /**
     * Get text content safely
     */
    getTextContent(element) {
        return element ? element.textContent.trim() : '';
    }

    /**
     * Flatten navigation structure for easier processing
     */
    flattenNavigation(navigation, result = []) {
        navigation.forEach(item => {
            result.push(item);
            if (item.children && item.children.length > 0) {
                this.flattenNavigation(item.children, result);
            }
        });
        return result;
    }

    /**
     * Convert HTML to plain text for clipboard
     */
    htmlToPlainText(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Replace common block elements with line breaks
        const blockElements = div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, br');
        blockElements.forEach(el => {
            if (el.tagName === 'BR') {
                el.replaceWith('\n');
            } else {
                el.insertAdjacentText('afterend', '\n\n');
            }
        });
        
        return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
    }

    /**
     * Sanitize HTML content for safe rendering
     */
    sanitizeHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Remove dangerous elements
        const dangerousSelectors = [
            'script', 'object', 'embed', 'form', 'input', 'button'
        ];
        
        dangerousSelectors.forEach(selector => {
            const elements = div.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // Remove dangerous attributes
        const allElements = div.querySelectorAll('*');
        allElements.forEach(el => {
            const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover'];
            dangerousAttrs.forEach(attr => {
                if (el.hasAttribute(attr)) {
                    el.removeAttribute(attr);
                }
            });
        });

        return div.innerHTML;
    }
}

// Export for use in app.js
window.EPUBParser = EPUBParser;
