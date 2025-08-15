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

export function generatePasswordFromPolicy(config: PasswordConfig): string {
  const words = [
    'blue', 'red', 'green', 'cat', 'dog', 'sun', 'moon', 'star', 'tree', 'bird',
    'fish', 'car', 'book', 'key', 'box', 'cup', 'pen', 'hat', 'bag', 'run',
    'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'new', 'old', 'good',
    'bad', 'easy', 'hard', 'soft', 'loud', 'quiet', 'dark', 'light', 'win', 'lose',
    'open', 'close', 'start', 'stop', 'home', 'work', 'play', 'rest', 'love', 'hope',
    'bright', 'dark', 'quick', 'slow', 'happy', 'sad', 'warm', 'cool', 'fresh', 'clean'
  ];
  
  const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '+', '=', '?'];
  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let passwordParts: string[] = [];
  
  // Generate components based on configuration
  for (const component of config.components) {
    for (let i = 0; i < component.count; i++) {
      switch (component.type) {
        case 'words':
          const randomWord = words[Math.floor(Math.random() * words.length)];
          // Capitalize first letter
          passwordParts.push(randomWord.charAt(0).toUpperCase() + randomWord.slice(1));
          break;
        case 'numbers':
          // Generate a group of 1-3 numbers
          const numberCount = Math.min(3, Math.max(1, Math.floor(config.targetLength / 8)));
          let numberGroup = '';
          for (let j = 0; j < numberCount; j++) {
            numberGroup += numbers[Math.floor(Math.random() * numbers.length)];
          }
          passwordParts.push(numberGroup);
          break;
        case 'symbols':
          passwordParts.push(symbols[Math.floor(Math.random() * symbols.length)]);
          break;
      }
    }
  }
  
  // Shuffle the password parts for better randomness
  for (let i = passwordParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordParts[i], passwordParts[j]] = [passwordParts[j], passwordParts[i]];
  }
  
  let generatedPassword = passwordParts.join('');
  
  // Adjust length to meet target
  if (generatedPassword.length < config.targetLength) {
    // Add more numbers to reach target length
    const needed = config.targetLength - generatedPassword.length;
    for (let i = 0; i < needed; i++) {
      generatedPassword += numbers[Math.floor(Math.random() * numbers.length)];
    }
  } else if (generatedPassword.length > config.targetLength) {
    // Trim to target length
    generatedPassword = generatedPassword.substring(0, config.targetLength);
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