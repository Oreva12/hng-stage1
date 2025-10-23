echo '# Single File String Analyzer Service

A complete RESTful API service for analyzing strings in a single file.

## Quick Start

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start the server:
\`\`\`bash
npm start
# or for development
npm run dev
\`\`\`

3. The API will be available at \`http://localhost:3000\`

## API Endpoints

- \`POST /strings\` - Analyze a string
- \`GET /strings/:string_value\` - Get specific string analysis
- \`GET /strings\` - Get all strings with filtering
- \`GET /strings/filter-by-natural-language\` - Natural language filtering
- \`DELETE /strings/:string_value\` - Delete a string
- \`GET /health\` - Health check

## Example Usage

\`\`\`bash
# Analyze a string
curl -X POST http://localhost:3000/strings \
  -H "Content-Type: application/json" \
  -d '\''{"value":"hello world"}'\''

# Get all palindromic strings
curl "http://localhost:3000/strings?is_palindrome=true"

# Natural language query
curl "http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings"
\`\`\`

## Features

- ✅ String property analysis (length, palindrome, unique chars, word count, etc.)
- ✅ SHA-256 hash generation
- ✅ Character frequency mapping
- ✅ Filtering by various criteria
- ✅ Natural language query processing
- ✅ In-memory storage (easy to replace with database)
- ✅ Comprehensive error handling
- ✅ Input validation' > README.md
