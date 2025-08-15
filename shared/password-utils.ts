export interface PasswordComponent {
  type: 'words' | 'numbers' | 'symbols';
  count: number;
}

export interface PasswordConfig {
  required: boolean;
  showGenerateButton: boolean;
  components: PasswordComponent[];
  targetLength: number;
}

// Import random-words library (works in both browser and Node.js)
let generate: any;
try {
  // Try to import random-words
  const randomWords = require('random-words');
  generate = randomWords.generate || randomWords;
} catch (e) {
  // Fallback for environments where random-words isn't available
  generate = () => {
    const fallbackWords = [
      'blue', 'red', 'green', 'cat', 'dog', 'sun', 'moon', 'star', 'tree', 'bird',
      'fish', 'car', 'book', 'key', 'box', 'cup', 'pen', 'hat', 'bag', 'run',
      'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'new', 'old', 'good',
      'bad', 'easy', 'hard', 'soft', 'loud', 'quiet', 'dark', 'light', 'win', 'lose',
      'open', 'close', 'start', 'stop', 'home', 'work', 'play', 'rest', 'love', 'hope'
    ];
    return fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
  };
}

export function generatePasswordFromPolicy(config: PasswordConfig): string {
  const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '+', '=', '?'];
  const numbers = '0123456789';
  
  // Calculate exact space allocation (same logic as CreateUserModal)
  const targetLength = config.targetLength;
  const totalNumbers = config.components.filter(c => c.type === 'numbers').reduce((sum, c) => sum + c.count, 0);
  const totalSymbols = config.components.filter(c => c.type === 'symbols').reduce((sum, c) => sum + c.count, 0);
  const totalWords = config.components.filter(c => c.type === 'words').reduce((sum, c) => sum + c.count, 0);
  
  // Calculate exact space available for words
  const spaceForWords = targetLength - totalNumbers - totalSymbols;
  const charsPerWord = totalWords > 0 ? Math.floor(spaceForWords / totalWords) : 0;
  
  // If we can't fit the components, adjust word length
  const minWordLength = Math.max(3, charsPerWord);
  
  let passwordParts: string[] = [];
  
  // Process each component according to admin configuration
  config.components.forEach(component => {
    for (let i = 0; i < component.count; i++) {
      switch (component.type) {
        case 'words':
          try {
            let selectedWord = '';
            
            // Aggressive search for real words - multiple rounds with large samples
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts && !selectedWord) {
              // Generate large sample of words with wide range
              const words = generate({
                min: 3,
                max: 20, // Go up to very long words
                exactly: 2000 // Large sample for better odds
              }) as string[];
              
              // Filter for exact length needed
              const exactLengthWords = words.filter(word => word.length === minWordLength);
              
              if (exactLengthWords.length > 0) {
                selectedWord = exactLengthWords[Math.floor(Math.random() * exactLengthWords.length)];
                break;
              }
              
              attempts++;
            }
            
            // If still no match after aggressive search, try with slightly wider range
            if (!selectedWord && attempts >= maxAttempts) {
              for (let range = 1; range <= 3; range++) {
                const words = generate({
                  min: Math.max(3, minWordLength - range),
                  max: minWordLength + range,
                  exactly: 1000
                }) as string[];
                
                const exactWords = words.filter(word => word.length === minWordLength);
                if (exactWords.length > 0) {
                  selectedWord = exactWords[Math.floor(Math.random() * exactWords.length)];
                  break;
                }
              }
            }
            
            // Final fallback with curated real words of various lengths
            if (!selectedWord) {
              const realWordsByLength = {
                3: ['cat', 'dog', 'sun', 'run', 'big', 'red', 'new', 'old', 'hot', 'car'],
                4: ['blue', 'tree', 'bird', 'fish', 'book', 'home', 'work', 'play', 'love', 'hope'],
                5: ['green', 'water', 'house', 'music', 'light', 'world', 'night', 'white', 'great', 'small'],
                6: ['purple', 'orange', 'yellow', 'family', 'friend', 'garden', 'window', 'change', 'animal', 'strong'],
                7: ['rainbow', 'morning', 'evening', 'freedom', 'journey', 'picture', 'kitchen', 'bedroom', 'amazing', 'awesome'],
                8: ['mountain', 'computer', 'elephant', 'birthday', 'sunshine', 'beautiful', 'wonderful', 'peaceful', 'powerful', 'colorful'],
                9: ['frightens', 'wonderful', 'beautiful', 'important', 'different', 'community', 'available', 'education', 'president', 'according'],
                10: ['everything', 'throughout', 'playground', 'background', 'foundation', 'generation', 'reputation', 'revolution', 'umberland', 'membership'],
                11: ['independent', 'temperature', 'concentrate', 'consequence', 'performance', 'communicate', 'photography', 'perspective', 'maintenance', 'immediately'],
                12: ['championship', 'contemporary', 'contribution', 'construction', 'professional', 'relationship', 'organization', 'intelligence', 'neighborhood', 'introduction']
              };
              
              if (realWordsByLength[minWordLength as keyof typeof realWordsByLength]) {
                const wordsOfTargetLength = realWordsByLength[minWordLength as keyof typeof realWordsByLength];
                selectedWord = wordsOfTargetLength[Math.floor(Math.random() * wordsOfTargetLength.length)];
              } else {
                // If we need a very unusual length, truncate from longer words
                const longerWords = realWordsByLength[12] || realWordsByLength[11] || realWordsByLength[10];
                if (longerWords) {
                  let baseWord = longerWords[Math.floor(Math.random() * longerWords.length)];
                  selectedWord = baseWord.substring(0, minWordLength);
                }
              }
            }
            
            // If we still don't have a word (very unlikely), use simple fallback
            if (!selectedWord) {
              selectedWord = 'password'.substring(0, Math.min(minWordLength, 8));
            }
            
            // Capitalize first letter only
            passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
          } catch (error) {
            // Emergency fallback - use simple real word
            const emergencyWords = ['blue', 'tree', 'water', 'music', 'light'];
            let word = emergencyWords[Math.floor(Math.random() * emergencyWords.length)];
            word = word.substring(0, Math.min(minWordLength, word.length));
            passwordParts.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
          }
          break;
          
        case 'numbers':
          const singleDigit = numbers[Math.floor(Math.random() * numbers.length)];
          passwordParts.push(singleDigit);
          break;
        case 'symbols':
          const selectedSymbol = symbols[Math.floor(Math.random() * symbols.length)];
          passwordParts.push(selectedSymbol);
          break;
      }
    }
  });
  
  // Join all parts (NO SHUFFLING - match CreateUserModal exactly)
  let password = passwordParts.join('');
  

  
  return password;
}

// Default password policy fallback
export const DEFAULT_PASSWORD_CONFIG: PasswordConfig = {
  required: false,
  showGenerateButton: true,
  targetLength: 12,
  components: [
    { type: 'words', count: 2 },
    { type: 'numbers', count: 2 },
    { type: 'symbols', count: 1 }
  ]
};