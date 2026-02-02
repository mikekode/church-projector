/**
 * Generate OG Images from HTML templates
 *
 * Usage: node scripts/generate-og-images.js
 *
 * Requires: npm install puppeteer (one-time)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const templates = [
    { input: 'og-image.html', output: 'og-image.png' },
    { input: 'og-subscribe.html', output: 'og-subscribe.png' },
    { input: 'og-propresenter.html', output: 'og-propresenter.png' },
    { input: 'og-easyworship.html', output: 'og-easyworship.png' },
];

async function generateImages() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set viewport to OG image dimensions
    await page.setViewport({ width: 1200, height: 630 });

    const templatesDir = path.join(__dirname, '..', 'public', 'og-templates');
    const outputDir = path.join(__dirname, '..', 'public');

    for (const template of templates) {
        const inputPath = path.join(templatesDir, template.input);
        const outputPath = path.join(outputDir, template.output);

        console.log(`Generating ${template.output}...`);

        // Load the HTML file
        await page.goto(`file://${inputPath}`, { waitUntil: 'networkidle0' });

        // Take screenshot
        await page.screenshot({
            path: outputPath,
            type: 'png',
            clip: { x: 0, y: 0, width: 1200, height: 630 }
        });

        console.log(`  ✓ Saved to ${outputPath}`);
    }

    await browser.close();
    console.log('\nAll OG images generated successfully!');
}

generateImages().catch(console.error);
