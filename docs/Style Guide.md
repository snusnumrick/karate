# Karate App Style Guide
## Limited Palette Design System

### Overview
This style guide defines the new limited color palette approach for the Karate application. It provides consistency, maintainability, and automatic dark mode support through CSS custom properties.

## Color Palette

### Primary Colors
- **Graphite** (`theme-graphite`): #374151 (light) / #d1d5db (dark) - Main text and primary elements
- **Yellow** (`theme-yellow`): #fef3c7 (light) / #f59e0b (dark) - Accent backgrounds and highlights
- **Green** (`theme-green`): #059669 (light) / #10b981 (dark) - Success states and primary actions
- **Red** (`theme-red`): #b91c1c (light) / #ef4444 (dark) - Error states and destructive actions

### Surface Colors
- **Background** (`theme-background`): #ffffff (light) / #111827 (dark) - Page backgrounds
- **Surface** (`theme-surface`): #f9fafb (light) / #1e293b (dark) - Cards and elevated surfaces
- **Text** (`theme-text`): #374151 (light) / #f9fafb (dark) - Primary text color
- **Border** (`theme-border`): #d1d5db (light) / #374151 (dark) - Borders and dividers

## Component Classes

### Pre-built Component Styles
Use these classes for consistent styling across the application:

```css
.page-background-styles     /* Page backgrounds - uses theme-yellow */
.page-header-styles        /* Main page headings - uses theme-text */
.page-subheader-styles     /* Subheadings with 70% opacity */
.form-container-styles     /* Card containers - uses theme-surface */
.form-card-styles         /* Inner cards - uses theme-yellow */
.form-header-styles       /* Form section headers - uses theme-green */
.input-custom-styles      /* Form inputs with focus states */
```

## Usage Guidelines

### Page Structure
```jsx
// Page wrapper
<div className="page-background-styles">
  <div className="max-w-7xl mx-auto px-4 py-8">
    
    {/* Page header */}
    <div className="text-center mb-12">
      <h1 className="page-header-styles text-3xl font-extrabold sm:text-4xl">
        Page Title
      </h1>
      <p className="page-subheader-styles mt-4 text-lg">
        Page description
      </p>
    </div>
    
    {/* Content cards */}
    <div className="form-container-styles p-6">
      <h2 className="form-header-styles text-xl font-semibold mb-4">
        Section Title
      </h2>
      <!-- Content -->
    </div>
  </div>
</div>
```

### Cards and Containers
```jsx
{/* Main container */}
<div className="form-container-styles p-6 hover:shadow-lg transition-shadow">
  
  {/* Card header */}
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2 bg-theme-green rounded-lg">
      <Icon className="h-5 w-5 text-white" />
    </div>
    <h2 className="form-header-styles text-xl font-semibold">Card Title</h2>
  </div>
  
  {/* Inner content card */}
  <div className="form-card-styles p-4 rounded-lg border-l-4 border-theme-green">
    Content here
  </div>
</div>
```

### Forms
```jsx
<form className="space-y-6">
  {/* Form section */}
  <div>
    <h2 className="form-header-styles text-xl font-semibold mb-4 pb-2 border-b border-theme-border">
      Section Title
    </h2>
    
    {/* Form field */}
    <div>
      <Label htmlFor="field" className="text-sm font-medium mb-1">
        Field Label<span className="text-theme-red">*</span>
      </Label>
      <Input
        id="field"
        name="field"
        className="input-custom-styles"
        required
      />
    </div>
  </div>
  
  {/* Submit button */}
  <Button className="w-full bg-theme-green hover:bg-theme-green/90 text-white font-medium py-3">
    Submit
  </Button>
</form>
```

### Buttons
```jsx
{/* Primary action */}
<Button className="bg-theme-green hover:bg-theme-green/90 text-white">
  Primary Action
</Button>

{/* Success action */}
<Button className="bg-theme-green hover:bg-theme-green/90 text-white">
  Confirm
</Button>

{/* Destructive action */}
<Button className="bg-theme-red hover:bg-theme-red/90 text-white">
  Delete
</Button>

{/* Secondary/highlight action */}
<Button className="bg-theme-yellow hover:bg-theme-yellow/90 text-theme-graphite">
  Highlight
</Button>

{/* Link button */}
<Button asChild className="bg-theme-green hover:bg-theme-green/90 text-white">
  <Link to="/path">Go Somewhere</Link>
</Button>
```

### Status Messages
```jsx
{/* Success message */}
<div className="bg-theme-green/10 text-theme-green border border-theme-green/20 p-3 rounded">
  Success message here
</div>

{/* Info/highlight message */}
<div className="bg-theme-yellow text-theme-graphite border border-theme-yellow p-3 rounded">
  Important information
</div>

{/* Error message */}
<div className="bg-theme-red/10 text-theme-red border border-theme-red/20 p-3 rounded">
  Error message here
</div>

{/* Warning using Alert component */}
<Alert variant="destructive" className="form-card-styles">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Action Required</AlertTitle>
  <AlertDescription>Please complete this step.</AlertDescription>
</Alert>
```

### Badges and Status Indicators
```jsx
{/* Success/Active badge */}
<Badge variant="default" className="bg-theme-green text-white">
  Active
</Badge>

{/* Info badge */}
<Badge variant="secondary" className="bg-theme-yellow text-theme-graphite">
  Trial
</Badge>

{/* Error badge */}
<Badge variant="destructive" className="bg-theme-red text-white">
  Expired
</Badge>

{/* Outline badge */}
<Badge variant="outline" className="border-theme-border text-theme-text">
  Inactive
</Badge>
```

### List Items and Cards
```jsx
{/* Interactive card/list item */}
<Link
  to="/detail"
  className="block p-4 form-card-styles rounded-lg border-l-4 border-theme-green hover:shadow-md transition-shadow group"
>
  <div className="flex justify-between items-start">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-theme-green" />
        <h3 className="font-bold text-theme-text group-hover:text-theme-green transition-colors">
          Item Title
        </h3>
      </div>
      <p className="text-sm text-theme-text opacity-70">
        Item description
      </p>
    </div>
    
    <Badge variant="default" className="bg-theme-green text-white">
      Status
    </Badge>
  </div>
</Link>
```

### Navigation and Headers
```jsx
{/* Section header with icon */}
<div className="flex items-center gap-3 mb-6">
  <div className="p-2 bg-theme-green rounded-lg">
    <Icon className="h-5 w-5 text-white" />
  </div>
  <h2 className="form-header-styles text-xl font-semibold">Section Title</h2>
</div>

{/* Page navigation link */}
<Link 
  to="/path" 
  className="text-theme-green hover:text-theme-green/80 hover:underline font-medium"
>
  Go to Page
</Link>
```

## Migration Guidelines

### For New Pages
1. Use `page-background-styles` for the main page wrapper
2. Use `page-header-styles` and `page-subheader-styles` for page titles
3. Use `form-container-styles` for main content cards
4. Use the theme color classes (`theme-green`, `theme-yellow`, etc.) instead of specific Tailwind colors

### For Existing Pages
1. **Phase 1**: Replace page-level background and text colors
    - `bg-amber-50 dark:bg-gray-800` → `page-background-styles`
    - `text-gray-900 dark:text-white` → `page-header-styles`

2. **Phase 2**: Update container and card styles
    - Replace custom bg/border combinations with component classes
    - Use `form-container-styles` and `form-card-styles`

3. **Phase 3**: Standardize interactive elements
    - Update buttons to use theme colors
    - Replace status indicators with theme-based variants

### Color Replacement Map
| Old Classes | New Classes |
|-------------|-------------|
| `bg-amber-50 dark:bg-gray-800` | `page-background-styles` |
| `text-gray-900 dark:text-white` | `page-header-styles` |
| `text-gray-500 dark:text-gray-400` | `page-subheader-styles` |
| `bg-white dark:bg-gray-700` | `form-container-styles` |
| `bg-amber-50 dark:bg-gray-800` | `form-card-styles` |
| `text-green-600 dark:text-green-400` | `form-header-styles` |
| `bg-green-600 hover:bg-green-700` | `bg-theme-green hover:bg-theme-green/90` |
| `text-red-500` | `text-theme-red` |

## Benefits

- **Consistency**: All pages use the same 4-color palette
- **Maintainability**: Change themes by updating CSS variables
- **Automatic Dark Mode**: No need for manual dark: classes
- **Performance**: Smaller CSS bundle
- **Developer Experience**: Easier to remember and use

## Do's and Don'ts

### ✅ Do
- Use the pre-built component classes when available
- Use theme color classes for consistency
- Use semantic color names (success = green, danger = red)
- Test in both light and dark modes

### ❌ Don't
- Mix old Tailwind color classes with theme classes in the same component
- Use hardcoded colors outside the theme palette
- Override theme colors with inline styles
- Forget to use hover states and transitions

## Support

For questions about implementing these styles or migrating existing components, refer to this guide or ask the development team.