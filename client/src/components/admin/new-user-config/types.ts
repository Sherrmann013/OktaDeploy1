export type FieldKey = 
  | 'firstName' 
  | 'lastName' 
  | 'emailUsername' 
  | 'password' 
  | 'title' 
  | 'manager' 
  | 'department' 
  | 'employeeType'
  | 'apps';

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

export interface EmailConfig {
  required: boolean;
  domains: string[];
}

export interface SelectConfig {
  required: boolean;
  useList: boolean;
  options: string[];
}

export interface BasicFieldConfig {
  required: boolean;
}

export interface FieldSettings {
  firstName: BasicFieldConfig;
  lastName: BasicFieldConfig;
  emailUsername: EmailConfig;
  password: PasswordConfig;
  title: BasicFieldConfig;
  manager: BasicFieldConfig;
  department: SelectConfig;
  employeeType: SelectConfig;
  apps: BasicFieldConfig;
}