// api/applications.js
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxxp6dGMt1DfdPt61qEdyJ5agUAlYi4BIyAD_ekrVDb_gOqGc0WhmfXHCADBgtqudjg0g/exec';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Vercel serverless functions automatically parse JSON request bodies
        const payload = req.body;
        
        if (!payload || !payload.applicationId || !payload.applicationData) {
            return res.status(400).json({ error: 'Application ID and application data are required.' });
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

        return res.status(200).json({ success: true, applicationId: payload.applicationId });
    } catch (error) {
        console.error('Application submission failed:', error.message);
        return res.status(502).json({ error: 'The application could not be saved. Please try again.' });
    }
}