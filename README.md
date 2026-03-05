# Reddyagency - Milk Store Business Management Web App

## Goal
A responsive, fast, offline-capable milk store management app that works as a static site (open `index.html` in a browser) using vanilla HTML, CSS, and JavaScript.

## Working Process / Implementation Plan
1. **Scaffold layout:** Set up `index.html` structure with shell navigation and main content area. Add basic CSS tokens and layout.
2. **Implement storage + migrations:** Create `storage.js` to handle `localStorage` reads/writes, schema versioning, and migrations.
3. **Implement product management:** Build UI and logic in `app.js` and `utils.js` to CRUD products.
4. **Implement checkout + stock deduction:** Build POS-like interface, calculate totals, handle payments, and deduct stock upon sale.
5. **Implement dashboard summaries:** Display today's sales, profit, low stock items, and top-selling products.
6. **Implement reports + filters:** Filter logic for data ranges and categories. Build tables for daily/monthly summaries.
7. **Implement suppliers:** CRUD operations for suppliers and linking to products.
8. **Implement export/import/reset:** Data tools to export to CSV, import from JSON, and clear data.
9. **Accessibility pass:** Check ARIA labels, focus states, and keyboard navigation.
10. **Final polish:** Ensure responsiveness across devices, add empty states.
