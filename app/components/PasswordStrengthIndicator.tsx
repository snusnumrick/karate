import { useMemo } from 'react';
import { calculatePasswordStrength, type PasswordStrength } from '~/utils/password-strength';

interface PasswordStrengthIndicatorProps {
  password: string;
  show?: boolean;
}

const strengthConfig: Record<PasswordStrength, { color: string; width: string; label: string }> = {
  weak: { color: 'bg-red-500', width: 'w-1/4', label: 'Weak' },
  fair: { color: 'bg-orange-500', width: 'w-1/2', label: 'Fair' },
  good: { color: 'bg-yellow-500', width: 'w-3/4', label: 'Good' },
  strong: { color: 'bg-green-500', width: 'w-full', label: 'Strong' }
};

export function PasswordStrengthIndicator({ password, show = true }: PasswordStrengthIndicatorProps) {
  const result = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!show || !password) {
    return null;
  }

  const config = strengthConfig[result.strength];

  return (
    <div className="mt-2 space-y-1">
      {/* Strength bar */}
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color} ${config.width} transition-all duration-300 ease-out`}
        />
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${
          result.strength === 'weak' ? 'text-red-600 dark:text-red-400' :
          result.strength === 'fair' ? 'text-orange-600 dark:text-orange-400' :
          result.strength === 'good' ? 'text-yellow-600 dark:text-yellow-400' :
          'text-green-600 dark:text-green-400'
        }`}>
          {config.label}
        </span>
        {result.feedback.length > 0 && result.strength !== 'strong' && (
          <span className="text-gray-500 dark:text-gray-400">
            {result.feedback[0]}
          </span>
        )}
      </div>
    </div>
  );
}
