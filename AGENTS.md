# AGENTS.md

## Project Context
- **Type**: Google Apps Script (GAS) standalone project.
- **Main Logic**: `Code.js` scrapes Gmail for bank notifications (Credit Card purchases), parses the content, and logs it to a Google Sheet.
- **Environment**: The code runs in the Google Apps Script environment attached to a Google Sheet.

## Dev Environment Tips
- **Files**:
    - `Code.js`: Contains all the logic (Gmail fetching, regex parsing, Sheet updating).
    - `README.md`: User-facing setup instructions.
- **Syntax**: Standard JavaScript (ES6 supported by GAS).
- **Libraries**: Uses `GmailApp` and `SpreadsheetApp` global services.

## Testing Instructions
- **Regex Logic Testing**:
    - The function `testRegex()` (lines ~406) contains hardcoded email body examples.
    - Run this function in the GAS editor to verify extraction logic without sending real emails or reading from Gmail.
    - If modifying the regex (`extractDataFromEmail`), ALWAYS update or run `testRegex` to ensure no regressions.
- **Debugging Real Emails**:
    - Use `debugEmails()` to fetch the last 3 matching emails from your actual Gmail inbox and log how the script "sees" the body. This is crucial for fixing parsing errors when the bank changes email formats.
- **Manual Verification**:
    - After running `procesarGastos()`, check the "Gastos" sheet.
    - Columns should be populated: Fecha, Comercio, Monto, Categoría, Medio Pago, ID Mensaje.
    - Check "Dashboard" generation with `crearDashboard()`.

## Deployment Instructions
- **Manual Sync**:
    1. Copy the full content of `Code.js`.
    2. Paste it into the Google Apps Script editor (`Extensions > Apps Script` in Sheets).
    3. Save (Ctrl+S).
    4. Reload the Google Sheets tab to refresh the custom menu.

## Code Conventions
- **Configuration**: Keep the `CONFIG` object at the top of `Code.js`.
- **Logging**: Use `console.log()` for output. These appear in the GAS "Executions" log.
- **Menu**: navigation and triggers are set in `onOpen()`.
