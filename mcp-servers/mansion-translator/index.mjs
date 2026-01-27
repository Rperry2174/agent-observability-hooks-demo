#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Spanish-English dictionary for mansion items
const DICTIONARY = {
  // Clue words for the puzzle (these form the final phrase)
  silencioso: 'silent',
  sombra: 'shadow',
  resuelve: 'solves',
  iluminado: 'moonlit',
  acertijo: 'riddle',
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

// Create the MCP server
const server = new Server(
  {
    name: 'mansion-translator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'translate',
        description: 'Translate a Spanish word to English. Specialized for mansion/mystery vocabulary.',
        inputSchema: {
          type: 'object',
          properties: {
            word: {
              type: 'string',
              description: 'The Spanish word to translate',
            },
          },
          required: ['word'],
        },
      },
      {
        name: 'list_vocabulary',
        description: 'List all known Spanish-English translations in the mansion vocabulary.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'translate') {
    const word = (args?.word || '').toString().toLowerCase().trim();
    
    if (!word) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No word provided for translation.',
          },
        ],
        isError: true,
      };
    }

    const translation = DICTIONARY[word];
    
    if (translation) {
      return {
        content: [
          {
            type: 'text',
            text: `Spanish: ${word}\nEnglish: ${translation}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown word: "${word}". Not in mansion vocabulary.\nKnown words: ${Object.keys(DICTIONARY).join(', ')}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'list_vocabulary') {
    const entries = Object.entries(DICTIONARY)
      .map(([es, en]) => `  ${es} → ${en}`)
      .join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `Mansion Vocabulary (Spanish → English):\n${entries}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mansion Translator MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
