const fs = require('fs');
const path = require('path');

// Read site.ts file
const siteContent = fs.readFileSync('app/config/site.ts', 'utf8');

// Extract site name
const nameMatch = siteContent.match(/name:\s*["']([^"']+)["']/);
const siteName = nameMatch ? nameMatch[1] : 'GREENEGIN KARATE';

// Extract primary color
const colorMatch = siteContent.match(/primary:\s*["']([^"']+)["']/);
const primaryColor = colorMatch ? colorMatch[1] : '#469a45';

// Extract site URL (look for siteUrl variable)
const urlMatch = siteContent.match(/(?:const\s+)?siteUrl\s*=\s*["']([^"']+)["']/) || 
                siteContent.match(/url:\s*["']([^"']+)["']/) ||
                siteContent.match(/url:\s*siteUrl/);

let siteUrl = 'https://karate.greenegin.ca';
if (urlMatch && urlMatch[1]) {
    siteUrl = urlMatch[1];
} else if (siteContent.includes('url: siteUrl')) {
    // Look for siteUrl definition
    const siteUrlMatch = siteContent.match(/const\s+siteUrl\s*=\s*["']([^"']+)["']/);
    if (siteUrlMatch) {
        siteUrl = siteUrlMatch[1];
    }
}

// Output as JSON for easy parsing
console.log(JSON.stringify({
    siteName,
    primaryColor,
    siteUrl,
    logoUrl: `${siteUrl}/logo-light.svg`
}));
