#!/usr/bin/env node
/**
 * Simple Spanish-English translator CLI for the mansion puzzle.
 * Usage: node scripts/translate.mjs <spanish_word>
 * 
 * This is a fallback for when MCP isn't available.
 */

const DICTIONARY = {
  // Weapons/items from the mansion puzzle
  cuchillo: 'knife',
  pistola: 'pistol',
  cuerda: 'rope',
  tuberia: 'lead pipe',
  veneno: 'poison',
  // Additional common words
  puerta: 'door',
  ventana: 'window',
  llave: 'key',
  libro: 'book',
  vela: 'candle',
  espejo: 'mirror',
  reloj: 'clock',
  cuadro: 'painting',
  alfombra: 'carpet',
  escalera: 'stairs',
};

const word = process.argv[2]?.toLowerCase().trim();

if (!word) {
  console.log('Mansion Vocabulary (Spanish → English):');
  for (const [es, en] of Object.entries(DICTIONARY)) {
    console.log(`  ${es} → ${en}`);
  }
  process.exit(0);
}

const translation = DICTIONARY[word];

if (translation) {
  console.log(`Spanish: ${word}`);
  console.log(`English: ${translation}`);
} else {
  console.error(`Unknown word: "${word}"`);
  console.error(`Known words: ${Object.keys(DICTIONARY).join(', ')}`);
  process.exit(1);
}
