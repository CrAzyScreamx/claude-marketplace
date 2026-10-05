#!/usr/bin/env node
'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Parse CLI args: generate.js "<prompt>" [--model <id>] [--output-dir <dir>]
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.error('Usage: node generate.js "<prompt>" [--model <model-id>] [--output-dir <dir>]');
  console.error('');
  console.error('Default model:black-forest-labs/flux.2-pro');
  console.error('Requires: OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

let prompt = '';
let model = 'black-forest-labs/flux.2-pro';
let outputDir = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) {
    model = args[++i];
  } else if (args[i] === '--output-dir' && args[i + 1]) {
    outputDir = args[++i];
  } else if (!args[i].startsWith('--')) {
    prompt = prompt ? `${prompt} ${args[i]}` : args[i];
  }
}

if (!prompt) {
  console.error('Error: prompt is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API key guard
// ---------------------------------------------------------------------------
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error(
    'Error: OPENROUTER_API_KEY is not set.\n' +
    'Set it in your environment and try again:\n' +
    '  Windows: $env:OPENROUTER_API_KEY="sk-or-..."\n' +
    '  Unix:    export OPENROUTER_API_KEY="sk-or-..."'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// OpenRouter uses /api/v1/chat/completions for ALL models (text and image).
// There is no separate /images/generations endpoint on OpenRouter.
// ---------------------------------------------------------------------------
const OPENROUTER_HOST = 'openrouter.ai';
const ENDPOINT = '/api/v1/chat/completions';

const requestBody = JSON.stringify({
  model,
  messages: [{ role: 'user', content: prompt }],
  modalities: ['image'],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function httpsPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: urlPath,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadUrl(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
}

function base64ToBuffer(b64) {
  // Strip data URI prefix if present
  const match = b64.match(/^data:image\/[^;]+;base64,(.+)$/s);
  return Buffer.from(match ? match[1] : b64, 'base64');
}

// ---------------------------------------------------------------------------
// Extract image from a chat/completions response
//
// When modalities: ['image'] is set, OpenRouter returns images in:
//   message.images = [{ image_url: { url: "data:image/...;base64,..." } }, ...]
//
// Fallback: some models put the image in message.content as an array of parts
// or as a plain data URI string.
// ---------------------------------------------------------------------------
async function extractImage(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) return null;

  // Primary: message.images (returned when modalities: ['image'] is requested)
  if (Array.isArray(message.images) && message.images.length > 0) {
    const url = message.images[0]?.image_url?.url;
    if (url) {
      if (url.startsWith('data:')) return base64ToBuffer(url);
      return await downloadUrl(url);
    }
  }

  // Fallback: content parts array
  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url') {
        const url = part.image_url?.url ?? part.image_url;
        if (!url) continue;
        if (url.startsWith('data:')) return base64ToBuffer(url);
        return await downloadUrl(url);
      }
    }
  }

  // Fallback: data URI embedded in a string
  if (typeof content === 'string') {
    if (/^data:image\//i.test(content)) return base64ToBuffer(content);
    const match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
    if (match) return base64ToBuffer(match[0]);
    const urlMatch = content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
    if (urlMatch) return await downloadUrl(urlMatch[0]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.error(`Model:  ${model}`);
  console.error(`Prompt: ${prompt}`);
  console.error('Calling OpenRouter...');

  const { status, body: response } = await httpsPost(
    OPENROUTER_HOST,
    ENDPOINT,
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://claude.ai',
      'X-Title': 'Claude Image Generator',
    },
    requestBody
  );

  if (status !== 200) {
    const msg =
      typeof response === 'object'
        ? response?.error?.message ?? JSON.stringify(response, null, 2)
        : String(response).slice(0, 500);
    console.error(`OpenRouter API error (HTTP ${status}):\n${msg}`);
    process.exit(1);
  }

  const imageBuffer = await extractImage(response);

  if (!imageBuffer) {
    const msg = response?.choices?.[0]?.message;
    console.error('No image data found in response.');
    console.error('message.images:', JSON.stringify(msg?.images, null, 2));
    console.error('message.content:', JSON.stringify(msg?.content, null, 2));
    process.exit(1);
  }

  // Save file
  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `generated-image-${timestamp}.png`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, imageBuffer);

  console.log(`Image saved: ${outputPath}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
