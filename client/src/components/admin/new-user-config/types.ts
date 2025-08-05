export type FieldKey = 
  | 'firstName' 
  | 'lastName' 
  | 'emailUsername' 
  | 'password' 
  | 'title' 
  | 'manager' 
  | 'department' 
  | 'employeeType'
  | 'apps'
  | 'groups'
  | 'sendActivationEmail';

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
  linkApps?: boolean; // For department field - enables app linking
  linkGroups?: boolean; // For department/employeeType fields - enables group linking
}

export interface GroupsConfig {
  required: boolean;
  useList: boolean;
  options: string[];
  hideField: boolean;
}

export interface BasicFieldConfig {
  required: boolean;
}

export interface AppsConfig {
  required: boolean;
  hideField: boolean;
}

export interface SendActivationEmailConfig {
  required: boolean;
  hideField: boolean;
  emailTemplate: string;
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
  apps: AppsConfig;
  groups: GroupsConfig;
  sendActivationEmail: SendActivationEmailConfig;
}