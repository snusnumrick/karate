import React from 'react';
import { cn } from '~/lib/utils';

interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface AdminCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface AdminCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

interface AdminCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

interface AdminCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface AdminCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const AdminCard = React.forwardRef<HTMLDivElement, AdminCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-white dark:bg-gray-800 rounded-lg shadow", className)}
      {...props}
    >
      {children}
    </div>
  )
);

const AdminCardHeader = React.forwardRef<HTMLDivElement, AdminCardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6 pb-4", className)}
      {...props}
    >
      {children}
    </div>
  )
);

const AdminCardTitle = React.forwardRef<HTMLHeadingElement, AdminCardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-xl font-semibold border-b pb-2 mb-4", className)}
      {...props}
    >
      {children}
    </h2>
  )
);

const AdminCardDescription = React.forwardRef<HTMLParagraphElement, AdminCardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-gray-500 mt-1", className)}
      {...props}
    >
      {children}
    </p>
  )
);

const AdminCardContent = React.forwardRef<HTMLDivElement, AdminCardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  )
);

const AdminCardFooter = React.forwardRef<HTMLDivElement, AdminCardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  )
);

AdminCard.displayName = "AdminCard";
AdminCardHeader.displayName = "AdminCardHeader";
AdminCardTitle.displayName = "AdminCardTitle";
AdminCardDescription.displayName = "AdminCardDescription";
AdminCardContent.displayName = "AdminCardContent";
AdminCardFooter.displayName = "AdminCardFooter";

export { 
  AdminCard, 
  AdminCardHeader, 
  AdminCardTitle, 
  AdminCardDescription, 
  AdminCardContent, 
  AdminCardFooter 
};