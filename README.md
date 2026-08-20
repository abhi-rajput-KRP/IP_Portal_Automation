# IP Portal Automation

Automation for entering internal assessment marks in the GGSIPU IP Portal.

## Overview

This repository contains two connected parts:

- **DemoPortal**: A React and Vite web portal with Firebase Authentication and Cloud Firestore. Authorized users can select a semester, view students, and update their marks.
- **AutomationExtention**: A Manifest V3 browser extension that reads student data and marks from `.xlsx`, `.xls`, or `.csv` files and autofills the matching rows in the portal.

## Typical workflow

1. Sign in to the Demo Portal.
2. Select the required semester and open its student list.
3. Open the IP Portal Autofill extension and upload the spreadsheet.
4. Match students by enrollment number or name, review the filled marks, and submit the changes in the portal.

## Repository structure

```text
DemoPortal/             React/Vite portal and Firebase integration
AutomationExtention/    Chrome-compatible spreadsheet autofill extension
```

See [DemoPortal/README.md](DemoPortal/README.md) for portal setup, Firebase configuration, local commands, and deployment instructions.

See [AutomationExtention/README.md](AutomationExtention/README.md) for browser installation, spreadsheet requirements, and extension usage.
