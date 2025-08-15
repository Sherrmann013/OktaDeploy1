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
            // Generate a broader range of words first
            const words = generate({
              min: 3,
              max: 8,
              exactly: 200 // Generate many words to have more options
            }) as string[];
            
            // First try to find words of exact length
            let exactLengthWords = words.filter(word => word.length === minWordLength);
            
            if (exactLengthWords.length > 0) {
              const selectedWord = exactLengthWords[Math.floor(Math.random() * exactLengthWords.length)];
              passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
            } else {
              // If no exact length found, use words that are close in length
              const closeWords = words.filter(word => word.length >= 3 && word.length <= minWordLength + 2);
              
              if (closeWords.length > 0) {
                let selectedWord = closeWords[Math.floor(Math.random() * closeWords.length)];
                
                // Truncate or pad the word to fit
                if (selectedWord.length > minWordLength) {
                  selectedWord = selectedWord.substring(0, minWordLength);
                }
                
                passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
              } else {
                // Fallback to built-in word list instead of just "Word"
                const fallbackWords = [
                  'blue', 'red', 'green', 'cat', 'dog', 'sun', 'moon', 'star', 'tree', 'bird',
                  'fish', 'car', 'book', 'key', 'box', 'cup', 'pen', 'hat', 'bag', 'run',
                  'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'new', 'old', 'good',
                  'bad', 'easy', 'hard', 'soft', 'loud', 'dark', 'light', 'win', 'home', 'work'
                ];
                let fallbackWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
                
                // Adjust length
                if (fallbackWord.length > minWordLength) {
                  fallbackWord = fallbackWord.substring(0, minWordLength);
                }
                
                passwordParts.push(fallbackWord.charAt(0).toUpperCase() + fallbackWord.slice(1).toLowerCase());
              }
            }
          } catch (error) {
            // Final fallback with random word from built-in list
            const fallbackWords = ['Blue', 'Red', 'Green', 'Cat', 'Dog', 'Sun', 'Moon', 'Star', 'Tree', 'Bird'];
            let fallbackWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
            
            if (fallbackWord.length > minWordLength) {
              fallbackWord = fallbackWord.substring(0, minWordLength);
            }
            
            passwordParts.push(fallbackWord);
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
  
  // CRITICAL: Ensure exact target length compliance (match CreateUserModal logic)
  if (password.length > targetLength) {
    password = password.substring(0, targetLength);
  } else if (password.length < targetLength) {
    // Pad with random numbers to reach exact target length
    const deficit = targetLength - password.length;
    for (let i = 0; i < deficit; i++) {
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }
  }
  
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