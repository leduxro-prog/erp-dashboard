# CYPHER ERP Premium Features - Integration Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install @tanstack/react-query lucide-react
```

### 2. Key Files Structure
```
src/
├── styles/
│   └── themes.ts              # Theme system with 3 variants
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── TopBar.tsx         # Global top bar
│   │   └── AppLayout.tsx      # Main layout wrapper
│   └── shared/
│       └── AIAssistant.tsx    # Floating AI chatbot
├── stores/
│   └── ui.store.ts            # Zustand store (updated)
├── App.tsx                    # React Router setup (updated)
└── main.tsx                   # Entry point (updated)
```

### 3. Update package.json Dependencies

Make sure you have:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^4.x",
    "lucide-react": "^0.x"
  }
}
```

---

## Theme System Usage

### Get Current Theme
```typescript
import { useUIStore } from '@/stores/ui.store';
import { getThemeConfig } from '@/styles/themes';

function MyComponent() {
  const { themeVariant } = useUIStore();
  const themeConfig = getThemeConfig(themeVariant);
  
  return (
    <div style={{ backgroundColor: themeConfig.bg }}>
      {/* Your content */}
    </div>
  );
}
```

### Apply Theme Colors
```typescript
import { getTextClasses, isDarkTheme } from '@/styles/themes';

function StyledText() {
  const { themeVariant } = useUIStore();
  const isDark = isDarkTheme(themeVariant);
  const textClass = getTextClasses(themeVariant, 'primary');
  
  return (
    <p className={textClass}>
      {isDark ? 'Dark Mode' : 'Light Mode'}
    </p>
  );
}
```

---

## Component Integration

### Sidebar
The sidebar is automatically integrated in AppLayout. To customize navigation:

```typescript
// Edit NAVIGATION_SECTIONS in Sidebar.tsx
const navigationSections: NavSection[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, href: '/' },
      // ... add more items
    ],
  },
];
```

### AI Assistant
Trigger from any component:

```typescript
import { useUIStore } from '@/stores/ui.store';

function MyButton() {
  const { toggleAIAssistant } = useUIStore();
  
  return (
    <button onClick={toggleAIAssistant}>
      Open AI Assistant
    </button>
  );
}
```

### Keyboard Shortcuts
Already implemented in AppLayout:
- **Cmd+K** - Search (placeholder)
- **Cmd+J** - Toggle AI Assistant

---

## Gemini API Integration (Next Step)

### Setup Environment
```env
VITE_GEMINI_API_KEY=your_api_key_here
VITE_GEMINI_MODEL=gemini-pro
```

### Update AIAssistant Component
Replace mock responses with real API:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const handleSend = async () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: import.meta.env.VITE_GEMINI_MODEL 
  });
  
  const result = await model.generateContent(input);
  const response = result.response.text();
  
  // Process response...
};
```

---

## Theme Customization

### Add New Theme
Edit `/src/styles/themes.ts`:

```typescript
export enum ThemeVariant {
  VENTURA_DARK = 'VENTURA_DARK',
  SONOMA_LIGHT = 'SONOMA_LIGHT',
  MONTEREY_PRO = 'MONTEREY_PRO',
  MY_CUSTOM_THEME = 'MY_CUSTOM_THEME', // Add here
}

const THEMES: Record<ThemeVariant, ThemeConfig> = {
  // ... existing themes
  [ThemeVariant.MY_CUSTOM_THEME]: {
    name: 'My Custom Theme',
    variant: ThemeVariant.MY_CUSTOM_THEME,
    bg: '#custom-bg-color',
    surface: '#custom-surface-color',
    // ... complete all required fields
  },
};
```

---

## Protected Routes

Current setup allows all routes to be protected by AppLayout. To add auth:

```typescript
// In App.tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Create ProtectedRoute component
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

// Use in routes
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  {/* routes */}
</Route>
```

---

## Performance Optimization

### React Query Setup
Already configured with optimal defaults:
- staleTime: 60 seconds (data is fresh for 1 minute)
- gcTime: 10 minutes (garbage collection after 10 min)
- retry: 1 (retry failed requests once)

Modify in App.tsx if needed:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120000,     // 2 minutes
      gcTime: 1200000,       // 20 minutes
      retry: 2,              // retry twice
    },
  },
});
```

### Page Lazy Loading
All pages are lazy loaded automatically. To add prefetching:

```typescript
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
);

// Prefetch on link hover
<Link 
  to="/dashboard" 
  onMouseEnter={() => prefetchDashboard()}
>
  Dashboard
</Link>
```

---

## Breadcrumb Navigation

Update route mappings in AppLayout.tsx:

```typescript
const ROUTE_BREADCRUMBS: Record<string, Breadcrumb[]> = {
  '/custom-route': [
    { label: 'Parent', href: '/parent' },
    { label: 'Current Page' },
  ],
  // ... more routes
};
```

---

## Mobile Responsiveness

The current design is optimized for desktop. For mobile support:

```typescript
// Add to Sidebar
import { useMediaQuery } from '@/hooks/useMediaQuery';

const isMobile = useMediaQuery('(max-width: 768px)');

return (
  <>
    {!isMobile && <Sidebar />}
    {isMobile && <MobileNav />}
    <AppLayout />
  </>
);
```

---

## State Management

### Zustand Store Usage
```typescript
import { useUIStore } from '@/stores/ui.store';

function Example() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    themeVariant,
    setThemeVariant,
    isAIAssistantOpen,
    toggleAIAssistant,
  } = useUIStore();

  return (
    <button onClick={toggleSidebar}>
      Toggle Sidebar
    </button>
  );
}
```

### Persist Custom State
Add to ui.store.ts partialize function:

```typescript
partialize: (state) => ({
  sidebarCollapsed: state.sidebarCollapsed,
  theme: state.theme,
  themeVariant: state.themeVariant,
  isAIAssistantOpen: state.isAIAssistantOpen,
  yourNewState: state.yourNewState, // Add here
}),
```

---

## Debugging

### Theme System
```typescript
import { getThemeConfig, isDarkTheme } from '@/styles/themes';

console.log('Current theme:', getThemeConfig(currentTheme));
console.log('Is dark?:', isDarkTheme(currentTheme));
```

### Store State
```typescript
import { useUIStore } from '@/stores/ui.store';

const state = useUIStore.getState();
console.log('Full UI state:', state);
```

### React Query
Add React Query DevTools:
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        {/* Your app */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </>
  );
}
```

---

## Common Tasks

### Change Default Theme
In ui.store.ts:
```typescript
themeVariant: ThemeVariant.SONOMA_LIGHT, // Change default
```

### Add Notification Badge
In TopBar.tsx:
```typescript
<button className="relative">
  <Bell size={18} />
  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
    {notificationCount}
  </span>
</button>
```

### Extend AI Quick Actions
In AIAssistant.tsx:
```typescript
const QUICK_ACTIONS = [
  // ... existing
  { label: 'Your action', query: 'Your query' },
];
```

### Add Sidebar Section
In Sidebar.tsx:
```typescript
{
  label: 'NEW_SECTION',
  items: [
    { id: 'item1', label: 'Item 1', icon: <Icon />, href: '/route1' },
  ],
}
```

---

## Troubleshooting

### Theme not applying
- Check `isDarkTheme()` is imported correctly
- Verify `getThemeConfig()` returns valid config
- Check Tailwind is processing dynamic classes

### AI Assistant not opening
- Verify `toggleAIAssistant` is being called
- Check Zustand store is initialized
- Look for z-index conflicts

### Routes not lazy loading
- Verify all page imports use React.lazy
- Check Suspense wraps lazy components
- Confirm LoadingSkeleton component exists

### Sidebar collapse not working
- Check `toggleSidebar` updates state
- Verify width transition classes
- Look for overflow hidden parent

---

## Best Practices

1. **Always use useUIStore** for theme/UI state
2. **Wrap async components** with Suspense + fallback
3. **Use theme variants** consistently across app
4. **Lazy load pages** for better performance
5. **Persist user preferences** in localStorage
6. **Handle errors gracefully** in API calls
7. **Test keyboard shortcuts** across browsers
8. **Monitor bundle size** with lazy routes

---

## Support

For issues or questions:
1. Check component documentation
2. Review theme system exports
3. Test in different theme variants
4. Check browser console for errors
5. Verify all dependencies installed

---

Generated: 2025-02-08
Status: Complete
Version: 1.0.0
