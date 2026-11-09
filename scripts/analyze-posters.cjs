/**
 * Automated Poster Vision Analysis Pipeline for Art Gasht (آرت‌گشت)
 * 
 * Inspects exhibition posters using Multimodal Vision AI to extract the exact
 * fine art medium (نقاشی، عکاسی، مجسمه‌سازی و حجم، سرامیک، نقاشی‌خط، و...)
 * by reading both the visual artwork texture and fine-print text on the poster.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const GALLERIES_FILE = path.join(__dirname, '..', 'src', 'data', 'galleries.json');

const VALID_MEDIUMS = [
  'نقاشی',
  'عکاسی',
  'مجسمه‌سازی و حجم',
  'سرامیک و حجم',
  'خوشنویسی و خط',
  'نقاشی‌خط',
  'طراحی و فیگور',
  'چاپ دستی',
  'چیدمان (اینستالیشن)',
  'هنر معاصر و چندرسانه‌ای',
  'هنر الیاف و بافت',
  'زیورآلات و مجسمه پوشیدنی',
  'گنجینه و اسناد هنر معاصر'
];

/**
 * Downloads image as Base64 string for Vision API inspection
 */
function downloadImageBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          base64: buffer.toString('base64'),
          mimeType: res.headers['content-type'] || 'image/jpeg'
        });
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Analyze an exhibition poster with Vision AI (Gemini 2.5 Flash / Multimodal API)
 */
async function analyzePosterWithVision(posterUrl, exhibitionTitle, artistName, apiKey) {
  if (!apiKey) {
    console.warn('⚠️ No Vision API key found. Skipping AI vision call.');
    return null;
  }

  const imgData = await downloadImageBase64(posterUrl);
  if (!imgData) return null;

  // Prompt tuned for Iranian Contemporary Art Exhibitions
  const prompt = `این تصویر پوستر یک رویداد هنری در تهران با عنوان «${exhibitionTitle}» اثر «${artistName}» است.
با بررسی دقیق تصویر اثر و نوشته‌های ریز پوستر (تکنیک، استیتمنت یا توضیحات انگلیسی)، مشخص کن مدیوم اصلی این نمایشگاه چیست.
تنها یکی از موارد زیر را برگردان:
${VALID_MEDIUMS.map(m => `- ${m}`).join('\n')}
فقط نام رشته انتخابی را بنویس بدون هیچ توضیح اضافی.`;

  // Standard Gemini 2.5 Flash Multimodal Endpoint
  const postData = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: imgData.mimeType,
              data: imgData.base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 30
    }
  });

  return new Promise((resolve) => {
    const req = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 25000
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text && VALID_MEDIUMS.includes(text)) {
              resolve(text);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

module.exports = {
  analyzePosterWithVision,
  VALID_MEDIUMS
};
