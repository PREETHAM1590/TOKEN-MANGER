"use client"

// @ts-nocheck - Type checking disabled for this file temporarily
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { useState, useEffect, useRef } from 'react'
import { toast, Toaster } from 'react-hot-toast'

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

// Define toast types
type ToastType = 'success' | 'error' | 'loading' | 'custom'

// Extend toast type
interface ExtendedToast {
  id: string
  message: string
  type: ToastType
  visible: boolean
}

// Store active toasts
let activeToasts: ExtendedToast[] = [];
let toastListeners: Function[] = [];

// Function to notify listeners when toasts change
const notifyListeners = () => {
  toastListeners.forEach(listener => listener([...activeToasts]));
};

// Toast container styles
const toastContainerStyles = {
  position: 'fixed' as const,
  bottom: '20px',
  right: '20px',
  maxWidth: '420px',
  zIndex: 9999,
}

// Individual toast styles
const toastStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#333',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '10px',
  marginBottom: '10px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  cursor: 'grab',
  position: 'relative' as const,
  overflow: 'hidden',
  transition: 'transform 0.3s ease, opacity 0.3s ease',
}

// Close button styles
const closeButtonStyles = {
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  marginLeft: '12px',
  opacity: 0.7,
  transition: 'opacity 0.2s',
}

interface CustomToastProps {
  toast: ExtendedToast
  onDismiss: (id: string) => void
}

export function CustomToast({ toast, onDismiss }: CustomToastProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const toastRef = useRef<HTMLDivElement>(null)

  // Handle dismiss
  const handleDismiss = () => {
    onDismiss(toast.id)
  }

  // Set up touch/mouse event handlers
  useEffect(() => {
    const element = toastRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      setIsDragging(true)
      setStartX(e.touches[0].clientX)
    }

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
      setStartX(e.clientX)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      const currentX = e.touches[0].clientX
      const diff = currentX - startX
      if (diff > 0) {
        setOffsetX(diff)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const currentX = e.clientX
      const diff = currentX - startX
      if (diff > 0) {
        setOffsetX(diff)
      }
    }

    const handleTouchEnd = () => {
      if (offsetX > (element.offsetWidth * 0.4)) {
        handleDismiss()
      } else {
        setOffsetX(0)
      }
      setIsDragging(false)
    }

    const handleMouseUp = () => {
      if (offsetX > (element.offsetWidth * 0.4)) {
        handleDismiss()
      } else {
        setOffsetX(0)
      }
      setIsDragging(false)
    }

    element.addEventListener('touchstart', handleTouchStart)
    element.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, startX, offsetX, toast.id])

  // Get indicator color based on toast type
  const getIndicatorColor = () => {
    if (toast.type === 'success') return '#10b981'
    if (toast.type === 'error') return '#ef4444'
    if (toast.type === 'loading') return '#3b82f6'
    return '#6b7280'
  }

  // Get icon based on toast type
  const getIconContent = () => {
    if (toast.type === 'success') return '✅'
    if (toast.type === 'error') return '❌'
    if (toast.type === 'loading') return '⏳'
    return null
  }

  return (
    <div
      ref={toastRef}
      style={{
        ...toastStyles,
        transform: `translateX(${offsetX}px)`,
        opacity: 1 - offsetX / 500,
        borderLeft: `4px solid ${getIndicatorColor()}`,
      }}
      className="toast-item"
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {getIconContent() && (
          <span style={{ marginRight: '10px', fontSize: '16px' }}>{getIconContent()}</span>
        )}
        <div>{toast.message}</div>
      </div>
      <button
        onClick={handleDismiss}
        style={closeButtonStyles}
        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseOut={(e) => (e.currentTarget.style.opacity = '0.7')}
        aria-label="Close toast"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function CustomToaster() {
  const [toasts, setToasts] = useState<ExtendedToast[]>([])
  
  // Subscribe to toast changes
  useEffect(() => {
    // Add listener to update state when toasts change
    const updateToasts = (newToasts: ExtendedToast[]) => {
      setToasts(newToasts);
    };
    
    toastListeners.push(updateToasts);
    
    // Initial update
    updateToasts([...activeToasts]);
    
    // Cleanup listener on unmount
    return () => {
      toastListeners = toastListeners.filter(listener => listener !== updateToasts);
    };
  }, []);

  // Dismiss toast
  const onDismiss = (id: string) => {
    // Remove from active toasts
    activeToasts = activeToasts.filter(t => t.id !== id);
    notifyListeners();
    
    // Also call the original dismiss
    toast.dismiss(id);
  }

  return (
    <>
      <div style={toastContainerStyles}>
        {toasts.slice(0, 3).map((toast, index) => {
          return (
            <div
              key={toast.id}
              style={{
                position: 'relative',
                marginBottom: '10px',
                opacity: toast.visible ? 1 : 0,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                animation: 'slideIn 0.3s ease-out',
              }}
            >
              <CustomToast toast={toast} onDismiss={onDismiss} />
            </div>
          )
        })}
      </div>
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}

// Intercept toast calls to track them
const originalToast = toast;

// Create custom toast methods
const createToast = (message: string, type: ToastType, options: any = {}) => {
  const id = options.id || `toast-${Date.now()}`;
  
  // Add to active toasts
  const newToast: ExtendedToast = {
    id,
    message,
    type,
    visible: true
  };
  
  // Limit the number of active toasts (keep newest)
  activeToasts = [newToast, ...activeToasts].slice(0, 5);
  notifyListeners();
  
  // Call the original toast method
  return originalToast(message, { 
    ...options,
    id,
    duration: type === 'loading' ? Infinity : 5000,
  });
}

// Exported methods
export const toastSuccess = (message: string, options = {}) => 
  createToast(message, 'success', options);

export const toastError = (message: string, options = {}) => 
  createToast(message, 'error', options);  

export const toastLoading = (message: string, options = {}) => 
  createToast(message, 'loading', options);

// Override toast dismiss to also update our tracked toasts
const originalDismiss = toast.dismiss;
toast.dismiss = (id?: string) => {
  if (id) {
    // Remove from active toasts
    activeToasts = activeToasts.filter(t => t.id !== id);
  } else {
    // Clear all toasts
    activeToasts = [];
  }
  notifyListeners();
  
  // Call original dismiss
  return originalDismiss(id);
};

// Set up exports for compatibility
export const setToastDefaults = () => {
  // Override the default toast methods
  toast.success = toastSuccess;
  toast.error = toastError;
  toast.loading = toastLoading;
}

export { toast }
