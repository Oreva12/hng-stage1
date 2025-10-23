const express = require('express');
const crypto = require('crypto');
//const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory storage (replace with database in production)
let stringStorage = new Map();

// String Analyzer Utility Class
class StringAnalyzer {
    static analyzeString(inputString) {
        if (typeof inputString !== 'string') {
            throw new Error('Input must be a string');
        }

        const trimmedString = inputString.trim();
        
        return {
            length: trimmedString.length,
            is_palindrome: this.isPalindrome(trimmedString),
            unique_characters: this.countUniqueCharacters(trimmedString),
            word_count: this.countWords(trimmedString),
            sha256_hash: this.generateSHA256(trimmedString),
            character_frequency_map: this.getCharacterFrequency(trimmedString)
        };
    }

    static isPalindrome(str) {
        const cleanStr = str.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanStr.length === 0) return false;
        return cleanStr === cleanStr.split('').reverse().join('');
    }

    static countUniqueCharacters(str) {
        return new Set(str.toLowerCase()).size;
    }

    static countWords(str) {
        return str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
    }

    static generateSHA256(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    static getCharacterFrequency(str) {
        const frequencyMap = {};
        for (const char of str.toLowerCase()) {
            frequencyMap[char] = (frequencyMap[char] || 0) + 1;
        }
        return frequencyMap;
    }

    static parseNaturalLanguageQuery(query) {
        const lowerQuery = query.toLowerCase();
        const filters = {};

        // Palindrome detection
        if (lowerQuery.includes('palindrom')) {
            filters.is_palindrome = true;
        }

        // Word count detection
        const singleWordMatch = lowerQuery.match(/single\s+word|one\s+word|word_count.*1/);
        const wordCountMatch = lowerQuery.match(/(\d+)\s+words?/);
        
        if (singleWordMatch) {
            filters.word_count = 1;
        } else if (wordCountMatch) {
            filters.word_count = parseInt(wordCountMatch[1]);
        }

        // Length detection
        const longerThanMatch = lowerQuery.match(/longer than\s*(\d+)/);
        const shorterThanMatch = lowerQuery.match(/shorter than\s*(\d+)/);
        const lengthMatch = lowerQuery.match(/(\d+)\s*characters?/);

        if (longerThanMatch) {
            filters.min_length = parseInt(longerThanMatch[1]) + 1;
        } else if (shorterThanMatch) {
            filters.max_length = parseInt(shorterThanMatch[1]) - 1;
        } else if (lengthMatch) {
            filters.min_length = parseInt(lengthMatch[1]);
            filters.max_length = parseInt(lengthMatch[1]);
        }

        // Character containment
        const containsCharMatch = lowerQuery.match(/contain(s|ing)?\s+(?:the\s+)?(?:letter\s+)?([a-z])/);
        if (containsCharMatch) {
            filters.contains_character = containsCharMatch[2];
        }

        // Vowel detection
        if (lowerQuery.includes('vowel')) {
            filters.contains_character = 'a';
        }

        return filters;
    }
}

// Storage Service Class
class StorageService {
    static storeStringAnalysis(stringValue, properties) {
        const analysis = {
            id: properties.sha256_hash,
            value: stringValue,
            properties: properties,
            created_at: new Date().toISOString()
        };
        
        stringStorage.set(stringValue, analysis);
        return analysis;
    }

    static getStringAnalysis(stringValue) {
        return stringStorage.get(stringValue);
    }

    static getAllStrings() {
        return Array.from(stringStorage.values());
    }

    static deleteStringAnalysis(stringValue) {
        return stringStorage.delete(stringValue);
    }

    static stringExists(stringValue) {
        return stringStorage.has(stringValue);
    }
}

// Filter Service Class
class FilterService {
    static filterStrings(strings, filters) {
        return strings.filter(analysis => {
            // Palindrome filter
            if (filters.is_palindrome !== undefined) {
                const isPalFilter = filters.is_palindrome === 'true';
                if (analysis.properties.is_palindrome !== isPalFilter) return false;
            }

            // Length filters
            if (filters.min_length !== undefined) {
                if (analysis.properties.length < parseInt(filters.min_length)) return false;
            }
            
            if (filters.max_length !== undefined) {
                if (analysis.properties.length > parseInt(filters.max_length)) return false;
            }

            // Word count filter
            if (filters.word_count !== undefined) {
                if (analysis.properties.word_count !== parseInt(filters.word_count)) return false;
            }

            // Character containment filter
            if (filters.contains_character !== undefined) {
                const char = filters.contains_character.toLowerCase();
                if (!analysis.properties.character_frequency_map[char]) return false;
            }

            return true;
        });
    }
}

// API Controllers
const createStringAnalysis = (req, res) => {
    try {
        const { value } = req.body;

        // Validation
        if (!value) {
            return res.status(400).json({ error: 'Missing required field: value' });
        }

        if (typeof value !== 'string') {
            return res.status(422).json({ error: 'Invalid data type: value must be a string' });
        }

        const trimmedValue = value.trim();
        if (trimmedValue.length === 0) {
            return res.status(400).json({ error: 'String cannot be empty or only whitespace' });
        }

        // Check if string already exists
        if (StorageService.stringExists(trimmedValue)) {
            return res.status(409).json({ error: 'String already exists in the system' });
        }

        // Analyze string
        const properties = StringAnalyzer.analyzeString(trimmedValue);
        
        // Store analysis
        const analysis = StorageService.storeStringAnalysis(trimmedValue, properties);

        res.status(201).json(analysis);
    } catch (error) {
        console.error('Error creating string analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getStringAnalysis = (req, res) => {
    try {
        const { string_value } = req.params;
        const decodedString = decodeURIComponent(string_value);
        
        const analysis = StorageService.getStringAnalysis(decodedString);
        
        if (!analysis) {
            return res.status(404).json({ error: 'String does not exist in the system' });
        }

        res.status(200).json(analysis);
    } catch (error) {
        console.error('Error retrieving string analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllStrings = (req, res) => {
    try {
        const filters = req.query;
        let allStrings = StorageService.getAllStrings();

        // Apply filters if any
        if (Object.keys(filters).length > 0) {
            // Validate query parameters
            if (filters.is_palindrome && !['true', 'false'].includes(filters.is_palindrome)) {
                return res.status(400).json({ error: 'Invalid is_palindrome value. Must be true or false' });
            }

            if (filters.min_length && isNaN(parseInt(filters.min_length))) {
                return res.status(400).json({ error: 'Invalid min_length value. Must be a number' });
            }

            if (filters.max_length && isNaN(parseInt(filters.max_length))) {
                return res.status(400).json({ error: 'Invalid max_length value. Must be a number' });
            }

            if (filters.word_count && isNaN(parseInt(filters.word_count))) {
                return res.status(400).json({ error: 'Invalid word_count value. Must be a number' });
            }

            if (filters.contains_character && filters.contains_character.length !== 1) {
                return res.status(400).json({ error: 'Invalid contains_character value. Must be a single character' });
            }

            allStrings = FilterService.filterStrings(allStrings, filters);
        }

        res.status(200).json({
            data: allStrings,
            count: allStrings.length,
            filters_applied: filters
        });
    } catch (error) {
        console.error('Error retrieving all strings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getByNaturalLanguage = (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Missing required query parameter: query' });
        }

        const filters = StringAnalyzer.parseNaturalLanguageQuery(query);
        
        if (Object.keys(filters).length === 0) {
            return res.status(400).json({ error: 'Unable to parse natural language query' });
        }

        let allStrings = StorageService.getAllStrings();
        const filteredStrings = FilterService.filterStrings(allStrings, filters);

        res.status(200).json({
            data: filteredStrings,
            count: filteredStrings.length,
            interpreted_query: {
                original: query,
                parsed_filters: filters
            }
        });
    } catch (error) {
        console.error('Error processing natural language query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteStringAnalysis = (req, res) => {
    try {
        const { string_value } = req.params;
        const decodedString = decodeURIComponent(string_value);
        
        const exists = StorageService.stringExists(decodedString);
        
        if (!exists) {
            return res.status(404).json({ error: 'String does not exist in the system' });
        }

        StorageService.deleteStringAnalysis(decodedString);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting string analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Routes
app.post('/strings', createStringAnalysis);
app.get('/strings/:string_value', getStringAnalysis);
app.get('/strings', getAllStrings);
app.get('/strings/filter-by-natural-language', getByNaturalLanguage);
app.delete('/strings/:string_value', deleteStringAnalysis);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        total_strings: StorageService.getAllStrings().length
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'String Analyzer Service',
        version: '1.0.0',
        endpoints: {
            'POST /strings': 'Create/analyze a string',
            'GET /strings/:string_value': 'Get specific string analysis',
            'GET /strings': 'Get all strings with filtering',
            'GET /strings/filter-by-natural-language': 'Natural language filtering',
            'DELETE /strings/:string_value': 'Delete a string',
            'GET /health': 'Service health check'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`String Analyzer Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API Documentation: http://localhost:${PORT}/`);
});

module.exports = app;