const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	
	await page.goto('http://localhost:8000/index.html', { waitUntil: 'networkidle2' });
	
	const pdfDataUri = await page.evaluate(async () => {
		const result = await generateCvAsBase64();
		return result;
	});
	
	const base64Data = pdfDataUri.split(",")[1];
	fs.writeFileSync('cv.pdf', Buffer.from(base64Data, 'base64'));
	
	await browser.close();
})();