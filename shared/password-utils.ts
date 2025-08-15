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
            
            // Generate words with broader range to accommodate any required length
            const maxRange = Math.max(15, minWordLength + 3); // Ensure we can find longer words
            const words = generate({
              min: 3,
              max: maxRange,
              exactly: 500 // Generate more words for better selection
            }) as string[];
            
            // First try to find words of exact required length
            const exactLengthWords = words.filter(word => word.length === minWordLength);
            
            if (exactLengthWords.length > 0) {
              selectedWord = exactLengthWords[Math.floor(Math.random() * exactLengthWords.length)];
            } else {
              // If no exact length found, try multiple generations
              let attempts = 0;
              while (attempts < 3 && !selectedWord) {
                const moreWords = generate({
                  min: Math.max(3, minWordLength - 1),
                  max: minWordLength + 1,
                  exactly: 300
                }) as string[];
                
                const exactWords = moreWords.filter(word => word.length === minWordLength);
                if (exactWords.length > 0) {
                  selectedWord = exactWords[Math.floor(Math.random() * exactWords.length)];
                  break;
                }
                attempts++;
              }
              
              // If still no exact match, use fallback with exact length words
              if (!selectedWord) {
                const fallbackWords = [
                  'wonderful', 'beautiful', 'important', 'different', 'following', 'community', 
                  'available', 'education', 'president', 'something', 'according', 'questions',
                  'frightens', 'buildings', 'standards', 'materials', 'marketing', 'generally',
                  'including', 'knowledge', 'landscape', 'meanwhile', 'obviously', 'recognize'
                ];
                
                const exactFallbacks = fallbackWords.filter(word => word.length === minWordLength);
                if (exactFallbacks.length > 0) {
                  selectedWord = exactFallbacks[Math.floor(Math.random() * exactFallbacks.length)];
                } else {
                  // Generate a word of exact length by padding/truncating
                  let baseWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
                  if (baseWord.length > minWordLength) {
                    selectedWord = baseWord.substring(0, minWordLength);
                  } else if (baseWord.length < minWordLength) {
                    // Extend word with common suffixes
                    const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'ness'];
                    selectedWord = baseWord;
                    while (selectedWord.length < minWordLength && suffixes.length > 0) {
                      const suffix = suffixes.shift()!;
                      if (selectedWord.length + suffix.length <= minWordLength) {
                        selectedWord += suffix;
                      }
                    }
                    // If still not long enough, pad with vowels
                    while (selectedWord.length < minWordLength) {
                      selectedWord += 'aeiou'[Math.floor(Math.random() * 5)];
                    }
                  } else {
                    selectedWord = baseWord;
                  }
                }
              }
            }
            
            // Capitalize first letter only
            passwordParts.push(selectedWord.charAt(0).toUpperCase() + selectedWord.slice(1).toLowerCase());
          } catch (error) {
            // Final fallback - generate word of exact length
            let fallbackWord = 'word';
            while (fallbackWord.length < minWordLength) {
              fallbackWord += 'aeiou'[Math.floor(Math.random() * 5)];
            }
            if (fallbackWord.length > minWordLength) {
              fallbackWord = fallbackWord.substring(0, minWordLength);
            }
            passwordParts.push(fallbackWord.charAt(0).toUpperCase() + fallbackWord.slice(1).toLowerCase());
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