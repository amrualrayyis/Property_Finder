# Property Finder

API-driven real-estate screening pipeline built in Node.js.

## Overview

This repository is a sanitized public portfolio version of a working personal research pipeline. It demonstrates how public property datasets can be acquired, normalized, optionally ranked with an LLM, and exported to CSV for human review.

The public script includes direct acquisition from New York City and Philadelphia open-data endpoints. Representative output files from completed runs are retained in the repository to show the final screening results. Credentials and selected private integration files were removed before publication.

## What the project demonstrates

- REST API acquisition with source-specific parsing
- Normalization of heterogeneous property records into a common schema
- Optional Gemini-assisted ranking with deterministic fallback behavior
- CSV generation for audit-friendly review in Excel or another analysis tool
- Separation of secrets from source code through environment variables
- Preservation of representative outputs from completed runs

## Data flow

```text
Public property APIs
        ↓
Source-specific acquisition
        ↓
Normalized candidate records
        ↓
Optional Gemini ranking
        ↓
CSV output for analyst review
```

## Technology

- Node.js
- Axios
- Google Gemini API (optional)
- CSV output
- Public municipal data APIs

## Run the public demo

```bash
npm install
cp .env.example .env
npm run screen
```

`GEMINI_API_KEY` is optional. When it is not configured, the pipeline still completes and exports the acquired records without AI ranking.

## Repository structure

- `find-best-deals.js` — public API acquisition, normalization, optional ranking, and CSV export
- `Best-Property-Deals.csv` — generated output from the public demo when present
- Additional CSV files — representative outputs from completed research runs

## Engineering decisions

### Authoritative source retrieval

The pipeline reads directly from public source APIs rather than treating locally cached results as authoritative.

### Graceful degradation

AI ranking is optional. If the Gemini API is unavailable or not configured, the workflow falls back to deterministic raw-data output instead of failing the entire run.

### Reviewable output

Results are written to CSV so they can be inspected, filtered, and retained independently of the application runtime.

## Portfolio note

This repository is intentionally sanitized. API credentials and selected private integration files are not included. The checked-in result files are representative outputs from successful runs and are included to demonstrate the completed workflow.

This project is an engineering portfolio example and not investment advice.
