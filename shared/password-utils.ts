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
            // Generate words with exact length using random-words library
            const words = generate({
              min: minWordLength,
              max: minWordLength,
              exactly: 50 // Generate many words to find ones with exact length
            }) as string[];
            
            // Filter to get words of exact length
            const exactLengthWords = words.filter(word => word.length === minWordLength);
            
            if (exactLengthWords.length > 0) {
              const selectedWord = exactLengthWords[Math.floor(Math.random() * exactLengthWords.length)];
              passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
            } else {
              // If no exact length words found, try generating with broader range and pick best fit
              const broaderWords = generate({
                min: Math.max(3, minWordLength - 1),
                max: minWordLength + 1,
                exactly: 100
              }) as string[];
              
              const bestFit = broaderWords.find(word => word.length === minWordLength);
              if (bestFit) {
                passwordParts.push(bestFit.charAt(0).toUpperCase() + bestFit.slice(1).toLowerCase());
              } else {
                // Final fallback: use closest length word and pad/trim
                const closestWord = broaderWords[0] || 'Word';
                let adjustedWord = closestWord.charAt(0).toUpperCase() + closestWord.slice(1).toLowerCase();
                
                if (adjustedWord.length < minWordLength) {
                  // Pad with numbers
                  while (adjustedWord.length < minWordLength) {
                    adjustedWord += numbers[Math.floor(Math.random() * numbers.length)];
                  }
                } else if (adjustedWord.length > minWordLength) {
                  // Trim to length
                  adjustedWord = adjustedWord.substring(0, minWordLength);
                }
                passwordParts.push(adjustedWord);
              }
            }
          } catch (error) {
            // Fallback if random-words fails
            const fallbackWord = generate() as string;
            let adjustedWord = fallbackWord.charAt(0).toUpperCase() + fallbackWord.slice(1).toLowerCase();
            
            // Adjust to target length
            if (adjustedWord.length < minWordLength) {
              while (adjustedWord.length < minWordLength) {
                adjustedWord += numbers[Math.floor(Math.random() * numbers.length)];
              }
            } else if (adjustedWord.length > minWordLength) {
              adjustedWord = adjustedWord.substring(0, minWordLength);
            }
            passwordParts.push(adjustedWord);
          }
          break;
          
        case 'numbers':
          passwordParts.push(numbers[Math.floor(Math.random() * numbers.length)]);
          break;
          
        case 'symbols':
          passwordParts.push(symbols[Math.floor(Math.random() * symbols.length)]);
          break;
      }
    }
  });
  
  // Shuffle the password parts for better randomness
  for (let i = passwordParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordParts[i], passwordParts[j]] = [passwordParts[j], passwordParts[i]];
  }
  
  let generatedPassword = passwordParts.join('');
  
  // Ensure we meet the target length exactly
  if (generatedPassword.length < targetLength) {
    // Add numbers to reach target
    const needed = targetLength - generatedPassword.length;
    for (let i = 0; i < needed; i++) {
      generatedPassword += numbers[Math.floor(Math.random() * numbers.length)];
    }
  } else if (generatedPassword.length > targetLength) {
    // Trim to exact target
    generatedPassword = generatedPassword.substring(0, targetLength);
  }
  
  return generatedPassword;
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