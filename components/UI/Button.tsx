
import { ReactNode } from 'react'
import { cn } from '@/src/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  isLoading?: boolean
}

export function Button({
  children,
  className,
  variant = 'default',
  size = 'default',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pharma-500 disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-pharma-600 text-white hover:bg-pharma-700 shadow-lg hover:shadow-xl active:scale-95': variant === 'default',
          'bg-red-600 text-white hover:bg-red-700 shadow-lg hover:shadow-xl active:scale-95': variant === 'destructive',
          'border-2 border-pharma-600 text-pharma-600 hover:bg-pharma-50': variant === 'outline',
          'bg-pharma-100 text-pharma-800 hover:bg-pharma-200': variant === 'secondary',
          'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
          'text-pharma-600 underline-offset-4 hover:underline': variant === 'link',
          'h-10 px-4 py-2': size === 'default',
          'h-9 rounded-md px-3': size === 'sm',
          'h-11 rounded-md px-8': size === 'lg',
          'h-10 w-10': size === 'icon',
        },
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  )
}
