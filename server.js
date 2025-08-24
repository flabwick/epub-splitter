/**
 * EPUB Splitter Backend Server
 * Serves EPUB files from the files/ directory and provides API endpoints
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 4205;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static('.'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'files/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Only EPUB files are allowed'), false);
    }
  }
});

/**
 * Get list of EPUB files in the files/ directory
 */
app.get('/api/files', async (req, res) => {
  try {
    const filesDir = path.join(__dirname, 'files');
    
    // Ensure files directory exists
    try {
      await fs.access(filesDir);
    } catch (error) {
      await fs.mkdir(filesDir, { recursive: true });
    }

    const files = await fs.readdir(filesDir);
    const epubFiles = files.filter(file => file.toLowerCase().endsWith('.epub'));
    
    const fileList = await Promise.all(
      epubFiles.map(async (filename) => {
        try {
          const filePath = path.join(filesDir, filename);
          const stats = await fs.stat(filePath);
          
          return {
            name: filename,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime || stats.ctime,
            path: `/api/files/${encodeURIComponent(filename)}`
          };
        } catch (error) {
          console.error(`Error reading file ${filename}:`, error);
          return null;
        }
      })
    );

    // Filter out null entries (files that couldn't be read)
    const validFiles = fileList.filter(file => file !== null);
    
    res.json({
      success: true,
      files: validFiles,
      count: validFiles.length
    });

  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list EPUB files',
      message: error.message
    });
  }
});

/**
 * Serve individual EPUB file
 */
app.get('/api/files/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(__dirname, 'files', filename);
    
    // Security check - ensure file is within files directory
    const resolvedPath = path.resolve(filePath);
    const filesDir = path.resolve(__dirname, 'files');
    
    if (!resolvedPath.startsWith(filesDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve file',
      message: error.message
    });
  }
});

/**
 * Upload EPUB files to the files/ directory
 */
app.post('/api/upload', upload.array('epubFiles'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      name: file.filename,
      size: file.size,
      path: `/api/files/${encodeURIComponent(file.filename)}`
    }));

    res.json({
      success: true,
      message: `Uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload files',
      message: error.message
    });
  }
});

/**
 * Delete an EPUB file
 */
app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(__dirname, 'files', filename);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const filesDir = path.resolve(__dirname, 'files');
    
    if (!resolvedPath.startsWith(filesDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete the file
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: `File ${filename} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

/**
 * Get server status and file count
 */
app.get('/api/status', async (req, res) => {
  try {
    const filesDir = path.join(__dirname, 'files');
    let fileCount = 0;
    
    try {
      const files = await fs.readdir(filesDir);
      fileCount = files.filter(file => file.toLowerCase().endsWith('.epub')).length;
    } catch (error) {
      // Directory doesn't exist yet
    }

    res.json({
      success: true,
      status: 'running',
      version: '1.0.0',
      fileCount: fileCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large'
      });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EPUB Splitter server running on http://localhost:${PORT}`);
  console.log(`📁 Serving EPUB files from: ${path.join(__dirname, 'files')}`);
  console.log(`🌐 Frontend available at: http://localhost:${PORT}`);
});

module.exports = app;
