#!/usr/bin/env node
// ========================================================
// Anti-Gallery (آرت‌گشت) Gallery Merger
// Merges local and primary galleries.json by gallery ID.
// Rule: Newest updatedAt wins. Missing updatedAt is populated.
// ========================================================

const fs = require('fs');
const path = require('path');

const primaryFile = process.argv[2];
const localFile = process.argv[3];
const outputFile = process.argv[4];

if (!primaryFile || !localFile || !outputFile) {
  console.error('Usage: node merge-galleries.cjs <primary.json> <local.json> <output.json>');
  process.exit(1);
}

function parseJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return [];
}

const primaryList = parseJson(primaryFile);
const localList = parseJson(localFile);

console.log(`[Merge] Loaded ${primaryList.length} primary galleries and ${localList.length} local galleries.`);

const nowIso = new Date().toISOString();
const mergedMap = new Map();

// Helper to get comparable timestamp
function getTimestamp(g) {
  if (g.updatedAt) {
    const t = new Date(g.updatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  return 0; // Baseline fallback
}

// 1. Index primary galleries
primaryList.forEach((g) => {
  if (!g.id) return;
  if (!g.updatedAt) g.updatedAt = nowIso;
  mergedMap.set(g.id, g);
});

let updatedFromLocalCount = 0;
let newLocalCount = 0;

// 2. Merge local galleries
localList.forEach((localG) => {
  if (!localG.id) return;
  if (!localG.updatedAt) localG.updatedAt = nowIso;

  if (mergedMap.has(localG.id)) {
    const primaryG = mergedMap.get(localG.id);
    const localTime = getTimestamp(localG);
    const primaryTime = getTimestamp(primaryG);

    if (localTime >= primaryTime) {
      mergedMap.set(localG.id, localG);
      updatedFromLocalCount++;
    }
  } else {
    // New gallery created in standalone mode on Iran VPS
    mergedMap.set(localG.id, localG);
    newLocalCount++;
  }
});

const mergedList = Array.from(mergedMap.values());

fs.writeFileSync(outputFile, JSON.stringify(mergedList, null, 2), 'utf-8');
console.log(`[Merge] Success! Total merged: ${mergedList.length} (New local: ${newLocalCount}, Overwritten from local: ${updatedFromLocalCount}).`);
