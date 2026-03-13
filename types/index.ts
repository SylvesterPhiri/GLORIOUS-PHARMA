

export enum ClientType {
  INDIVIDUAL = 'INDIVIDUAL',
  HOSPITAL = 'HOSPITAL',
  PHARMACY = 'PHARMACY',
  COMPANY = 'COMPANY'
}

export enum ProductType {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  OINTMENT = 'OINTMENT',
  OTHER = 'OTHER'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  type: ClientType;
  creditLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Manufacturer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  motherCompany?: string;
  address?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  genericName?: string;
  type: ProductType;
  category?: string;
  manufacturerId: string;
  batchNumber: string;
  expiryDate: Date;
  unit: string;
  price: number;
  currentStock: number;
  initialStock: number;
  minStock: number;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithManufacturer extends Product {
  manufacturer: {
    id: string;
    name: string;
    motherCompany: string | null;
  } | null;
}

export interface ProductWithStatus extends ProductWithManufacturer {
  stockStatus: 'LOW' | 'MEDIUM' | 'GOOD';
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  invoiceDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  subTotal: number;
  tax: number;
  total: number;
  notes?: string;
  hasReturns: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  freeSamples: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  chequeNumber?: string;
  bankName?: string;
  paymentDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Return {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  reason: string;
  returnDate: Date;
  createdAt: Date;
  updatedAt: Date;
}