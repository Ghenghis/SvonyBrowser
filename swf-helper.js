// Function to find SWF file (similar to findFlashPlugin)
function findSWFFile(swfName) {
    const possibleDirs = [
        path.join(__dirname, 'swf'),
        path.join(process.resourcesPath || __dirname, 'swf'),
        path.join(app.getAppPath(), 'swf'),
        path.join(path.dirname(process.execPath), 'resources', 'swf')
    ];

    for (const dir of possibleDirs) {
        try {
            const swfPath = path.join(dir, swfName);
            if (fs.existsSync(swfPath)) {
                console.log('[SWF] Found SWF file: ' + swfPath);
                return swfPath;
            }
        } catch (e) { /* ignore */ }
    }
    
    console.warn('[SWF] SWF file not found: ' + swfName);
    return null;
}

// Get default SWF path
function getDefaultSWFPath() {
    return findSWFFile('AutoEvony.swf');
}
