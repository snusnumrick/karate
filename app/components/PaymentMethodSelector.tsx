import React from 'react';
import { InvoicePaymentMethod } from '~/types/invoice';
import { CreditCard, DollarSign, Building, Smartphone, Banknote, MoreHorizontal } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: InvoicePaymentMethod;
  onChange: (method: InvoicePaymentMethod) => void;
  className?: string;
  disabled?: boolean;
}

interface PaymentMethodOption {
  value: InvoicePaymentMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    value: 'cash',
    label: 'Cash',
    description: 'Physical cash payment',
    icon: DollarSign
  },
  {
    value: 'check',
    label: 'Check',
    description: 'Personal or business check',
    icon: Banknote
  },
  {
    value: 'credit_card',
    label: 'Credit Card',
    description: 'Credit or debit card payment',
    icon: CreditCard
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Wire transfer or online banking',
    icon: Building
  },
  {
    value: 'ach',
    label: 'ACH',
    description: 'Automated Clearing House transfer',
    icon: Smartphone
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other payment method',
    icon: MoreHorizontal
  }
];

export default function PaymentMethodSelector({
  value,
  onChange,
  className = '',
  disabled = false
}: PaymentMethodSelectorProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {paymentMethods.map((method) => {
        const Icon = method.icon;
        const isSelected = value === method.value;
        
        return (
          <label
            key={method.value}
            className={`
              relative flex items-center p-4 border rounded-lg cursor-pointer transition-all
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="payment_method"
              value={method.value}
              checked={isSelected}
              onChange={(e) => onChange(e.target.value as InvoicePaymentMethod)}
              disabled={disabled}
              className="sr-only"
            />
            
            <div className="flex items-center space-x-3 flex-1">
              <div className={`
                p-2 rounded-lg
                ${isSelected 
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }
              `}>
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1">
                <div className={`
                  font-medium
                  ${isSelected 
                    ? 'text-blue-900 dark:text-blue-100' 
                    : 'text-gray-900 dark:text-gray-100'
                  }
                `}>
                  {method.label}
                </div>
                <div className={`
                  text-sm
                  ${isSelected 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-500 dark:text-gray-400'
                  }
                `}>
                  {method.description}
                </div>
              </div>
            </div>
            
            {isSelected && (
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            )}
          </label>
        );
      })}
    </div>
  );
}

// Export the payment methods for use in other components
export { paymentMethods };
export type { PaymentMethodOption };