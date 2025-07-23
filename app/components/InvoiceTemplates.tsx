import { useState } from "react";
import { MagnifyingGlassIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { 
  invoiceTemplates, 
  getTemplatesByCategory, 
  getTemplateCategories, 
  searchTemplates
} from "~/data/invoice-templates";
import type { InvoiceTemplate, CreateInvoiceLineItemData } from "~/types/invoice";
import { formatCurrency } from "~/hooks/use-invoice-calculations";
import { calculateLineItemTotal } from "~/utils/line-item-helpers";

interface InvoiceTemplatesProps {
  onSelectTemplate: (template: InvoiceTemplate) => void;
  onClose?: () => void;
}

export function InvoiceTemplates({ onSelectTemplate, onClose }: InvoiceTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = getTemplateCategories();
  
  const filteredTemplates = searchQuery
    ? searchTemplates(searchQuery)
    : selectedCategory === 'all'
    ? invoiceTemplates
    : getTemplatesByCategory(selectedCategory as InvoiceTemplate['category']);

  const calculateTemplateTotal = (template: InvoiceTemplate): number => {
    return template.lineItems.reduce((total: number, item: CreateInvoiceLineItemData) => total + calculateLineItemTotal(item), 0);
  };

  return (
    <div className="bg-white dark:bg-gray-800">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Invoice Templates</h3>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
          Choose from pre-built templates to quickly create invoices
        </p>
      </div>

      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        {/* Search */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-custom-styles pl-10"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              selectedCategory === 'all'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Templates
          </button>
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedCategory === category.value
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 max-h-96 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <p className="mt-2">No templates found</p>
            {searchQuery && (
              <p className="text-sm">Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => {
              const templateTotal = calculateTemplateTotal(template);
              
              return (
                <div
                  key={template.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-green-300 dark:hover:border-green-500 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700"
                  onClick={() => onSelectTemplate(template)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectTemplate(template);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select template: ${template.name}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                        {template.description}
                      </p>
                    </div>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                      {template.category}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {template.lineItems.length} line item{template.lineItems.length !== 1 ? 's' : ''}
                    </div>
                    
                    <div className="space-y-1">
                      {template.lineItems.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {item.description}
                          </span>
                          <span className="text-gray-900 dark:text-white font-medium ml-2">
                            {formatCurrency(calculateLineItemTotal(item))}
                          </span>
                        </div>
                      ))}
                      {template.lineItems.length > 3 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          +{template.lineItems.length - 3} more item{template.lineItems.length - 3 !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {templateTotal > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between text-sm font-medium">
                          <span>Template Total:</span>
                          <span>{formatCurrency(templateTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTemplate(template);
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Templates provide starting points for common invoice types. You can modify line items, prices, and terms after selecting a template.
        </p>
      </div>
    </div>
  );
}