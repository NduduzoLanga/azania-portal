// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxxp6dGMt1DfdPt61qEdyJ5agUAlYi4BIyAD_ekrVDb_gOqGc0WhmfXHCADBgtqudjg0g/exec';

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 25 * 1024 * 1024) {
                reject(new Error('Application payload is too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

async function handleApplicationSubmission(req, res) {
    try {
        const payload = JSON.parse(await readRequestBody(req));
        if (!payload.applicationId || !payload.applicationData) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Application ID and application data are required.' }));
            return;
        }

        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const providerBody = await response.text();
        let providerResult;
        try {
            providerResult = JSON.parse(providerBody);
        } catch {
            throw new Error('Google Apps Script did not return a valid JSON response.');
        }

        if (!providerResult.success) {
            throw new Error(providerResult.error || 'Failed to save application to Google Sheets.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, applicationId: payload.applicationId }));
    } catch (error) {
        console.error('Application submission failed:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'The application could not be saved. Please try again.' }));
    }
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/applications') {
        handleApplicationSubmission(req, res);
        return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(path.resolve(filePath), (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(req.method === 'HEAD' ? undefined : content, 'utf-8');
        }
    });
});

server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or start with a different PORT.`);
    } else {
        console.error('Server failed to start:', error.message);
    }
    process.exitCode = 1;
});

server.listen(PORT, () => {
    console.log(`\n✅ Azania Portal is running!`);
    console.log(`🌐 Open your browser and go to: http://localhost:${PORT}\n`);
});