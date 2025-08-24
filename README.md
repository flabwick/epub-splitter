# EPUB Splitter

A complete web application with Node.js backend for extracting and exporting selected chapters from EPUB files. Features a backend server that manages EPUB files and a frontend that parses EPUB structure, allows chapter selection, and exports formatted content.

## Features

- **Backend Server**: Node.js/Express server that manages EPUB files from a local directory
- **File Management**: Automatically loads EPUB files from the server's files/ directory
- **Chapter Selection**: View hierarchical chapter structure with individual selection controls
- **Content Export**: Export selected chapters as formatted HTML with copy-to-clipboard functionality
- **Error Handling**: Robust error handling with detailed error reporting for problematic files
- **Responsive Design**: Works on desktop and tablet devices
- **API Integration**: Frontend communicates with backend via REST API

## Quick Start

### Backend Setup
1. **Download or clone** this repository to your computer
2. **Install dependencies**: `npm install`
3. **Add EPUB files** to the `files/` directory
4. **Start the server**: `npm start` or `node server.js`
5. **Open your browser** to `http://localhost:4205`

### Using the Application
1. **View available EPUBs** - files are automatically loaded from the server
2. **Click "Refresh"** to reload the file list if you add new EPUBs
3. **Click on any EPUB** to view its chapter structure
4. **Select chapters** you want to export using checkboxes
5. **Click "Export Selected Chapters"** to generate formatted content
6. **Click "Copy to Clipboard"** to copy the content for use elsewhere

## Detailed Usage Guide

### Adding EPUB Files

1. **Add EPUB files** to the `files/` directory in the project folder
2. **Click "Refresh"** to reload the file list from the server
3. Files will appear as cards in the main interface
4. Any files that fail to parse will be listed in the collapsible error section

### Viewing EPUB Structure

1. **Click on any EPUB file card** to open the chapter viewer
2. The app will parse the EPUB and display:
   - Book title and author information
   - Total chapter count
   - Hierarchical list of all chapters with estimated word counts

### Selecting Chapters

- **Individual Selection**: Check/uncheck boxes next to specific chapters
- **Select All**: Use the "Select All" button to select every chapter
- **Deselect All**: Use the "Deselect All" button to clear all selections
- **Nested Chapters**: Child chapters are indented under their parent sections
- **Selection Counter**: The footer shows how many chapters are currently selected

### Exporting Content

1. **Click "Export Selected Chapters"** when you have chapters selected
2. The export page will show:
   - Summary of what's being exported
   - Formatted content with book title, author, and selected chapters
   - Each chapter separated with clear headings and dividers

### Copying to Clipboard

1. **Click "Copy to Clipboard"** on the export page
2. A success message will appear confirming the copy operation
3. The content is copied as plain text with formatting preserved through line breaks
4. Paste the content into any text editor, document, or application

## Browser Compatibility

### Supported Browsers
- **Chrome/Chromium** 76+ (recommended)
- **Firefox** 69+
- **Safari** 13+
- **Edge** 79+

### Required Features
- ES6+ JavaScript support
- File API for reading local files
- JSZip library for EPUB parsing
- Clipboard API for copy functionality (with fallback)

### Limitations
- **File Size**: Large EPUB files (>100MB) may be slow to process
- **Memory**: Complex EPUBs with many chapters may use significant browser memory
- **Local Files Only**: Cannot process EPUBs from URLs or cloud storage directly

## EPUB Support

### Supported EPUB Features
- **EPUB 2 and EPUB 3** formats
- **Table of Contents** parsing (nav.xhtml and toc.ncx)
- **Hierarchical chapter structure** with nested sections
- **Metadata extraction** (title, author, chapter count)
- **XHTML content** with basic formatting preservation

### Content Processing
- **HTML Sanitization**: Removes scripts, dangerous elements, and attributes
- **Image Removal**: Strips images and media for text-only export
- **Formatting Preservation**: Maintains paragraphs, headings, emphasis, and structure
- **Text Extraction**: Converts HTML to clean plain text for clipboard

### Unsupported Features
- **DRM-protected EPUBs**: Cannot parse encrypted or DRM-protected files
- **Image Export**: Images are removed from exported content
- **Complex Layouts**: Advanced CSS layouts may not render correctly
- **Interactive Elements**: Forms, scripts, and interactive content are removed

## Error Handling

### Common Issues

**"Missing META-INF/container.xml"**
- File is not a valid EPUB format
- File may be corrupted or incomplete

**"No rootfile found in container.xml"**
- EPUB structure is malformed
- Try re-downloading the EPUB file

**"Navigation parsing failed"**
- EPUB may lack proper table of contents
- App will fall back to spine order for chapter listing

**"Failed to extract chapter content"**
- Individual chapter files may be corrupted
- Other chapters may still be accessible

### Troubleshooting

1. **Refresh the page** if the app becomes unresponsive
2. **Try smaller EPUB files** if experiencing memory issues
3. **Check browser console** (F12) for detailed error messages
4. **Use different browser** if compatibility issues occur
5. **Verify EPUB file integrity** by opening in a dedicated EPUB reader

## Technical Architecture

### File Structure
```
epub-splitter/
├── server.js           # Node.js Express backend server
├── package.json        # Node.js dependencies and scripts
├── index.html          # Main application interface
├── app.js              # Core application logic and state management
├── epub-parser.js      # EPUB parsing and content extraction
├── styles.css          # Responsive UI styling
├── files/              # Directory containing EPUB files
└── README.md           # This documentation
```

### Key Components

**EPUBParser Class** (`epub-parser.js`)
- ZIP file extraction using JSZip library
- XML/HTML parsing with DOMParser
- Navigation structure analysis (EPUB2/EPUB3)
- Content sanitization and text extraction

**EPUBSplitterApp Class** (`app.js`)
- File management and UI state
- Chapter selection and export logic
- Clipboard operations with fallbacks
- Error handling and user feedback

### Dependencies

**Backend:**
- **Express**: Web server framework
- **CORS**: Cross-origin resource sharing
- **Multer**: File upload handling

**Frontend:**
- **JSZip 3.10.1**: EPUB file parsing (loaded from CDN)
- **Modern Browser APIs**: File API, Clipboard API, DOMParser

## Development Notes

### Extending the Application

**Adding Export Formats**
- Modify `generateExportContent()` in `app.js`
- Add format selection UI elements
- Implement format-specific content generation

**Improving EPUB Support**
- Enhance navigation parsing in `epub-parser.js`
- Add support for additional metadata fields
- Implement image extraction and export

**Adding Persistence**
- Implement localStorage for file history
- Add bookmarking for frequently accessed EPUBs
- Save user preferences and selection history

### Performance Optimization

**For Large Files**
- Implement lazy loading for chapter content
- Add pagination for chapter lists
- Use Web Workers for parsing operations

**Memory Management**
- Clear unused EPUB data when switching files
- Implement content streaming for very large chapters
- Add progress indicators for long operations

## License

This project is provided as-is for educational and personal use. Feel free to modify and distribute according to your needs.

## Support

For issues or questions:
1. Check the error section in the app for specific error messages
2. Verify your EPUB files work in other EPUB readers
3. Test with different browsers if experiencing compatibility issues
4. Check browser console (F12) for detailed error information

## Backend API

The server provides the following REST API endpoints:

- **GET `/api/files`** - List all EPUB files with metadata
- **GET `/api/files/:filename`** - Download a specific EPUB file
- **POST `/api/upload`** - Upload new EPUB files
- **DELETE `/api/files/:filename`** - Delete an EPUB file
- **GET `/api/status`** - Server status and file count

## Installation & Setup

### Prerequisites
- **Node.js** 14+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation Steps
1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Add EPUB files to the `files/` directory
5. Start the server: `npm start`
6. Open `http://localhost:4205` in your browser

### Configuration
- Server runs on port 4205 by default
- EPUB files are served from the `files/` directory
- CORS is enabled for frontend-backend communication

## Version History

**v2.0** - Backend Integration
- Node.js Express backend server
- REST API for file management
- Server-side EPUB file serving
- Automatic file discovery and loading

**v1.0** - Initial release
- Basic EPUB parsing and chapter extraction
- Hierarchical chapter selection
- HTML export with clipboard functionality
- Responsive web interface
- Error handling and reporting
