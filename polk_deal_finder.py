#!/usr/bin/env python3
"""
Polk County FL — Tax Deed Deal Finder
======================================
Pulls the free Tax Deed Applications CSV from the Polk County Tax Collector,
cross-references each parcel with the Polk County Property Appraiser (PCPAO),
then scores and filters for genuinely good deals.

Usage:
    python polk_deal_finder.py                  # default filters
    python polk_deal_finder.py --min-equity 0.6 # 60%+ equity only
    python polk_deal_finder.py --no-vacant      # skip $0 building value
    python polk_deal_finder.py --otc-only       # List of Lands (no auction)
    python polk_deal_finder.py --out deals.csv  # save results

Requirements:
    pip install requests beautifulsoup4 pandas tabulate
"""

import argparse
import time
import sys
import re
import json
from pathlib import Path

import requests
import pandas as pd
from bs4 import BeautifulSoup
from tabulate import tabulate

# ── Constants ────────────────────────────────────────────────────────────────

# Polk County Tax Collector — free Tax Deed Applications download
TAX_DEED_CSV_URL = "https://www.polktaxes.com/downloads/taxdeed.csv"

# Polk County Property Appraiser search endpoint
PCPAO_SEARCH = "https://www.polkflpa.gov/PropertySearch"
PCPAO_PARCEL  = "https://www.polkflpa.gov/PropertySearch/Parcel/Detail/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Seconds to wait between PCPAO requests — be polite to public servers
RATE_LIMIT = 1.5

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Polk County tax deed deal scanner")
    p.add_argument("--min-equity",   type=float, default=0.50,
                   help="Min equity ratio (market−price)/market [default: 0.50]")
    p.add_argument("--max-price",    type=float, default=None,
                   help="Max purchase/redemption price in $ [default: no limit]")
    p.add_argument("--no-vacant",    action="store_true",
                   help="Skip parcels with $0 building value")
    p.add_argument("--otc-only",     action="store_true",
                   help="Only show List of Lands (over-the-counter) properties")
    p.add_argument("--max-parcels",  type=int,   default=200,
                   help="Max parcels to look up from PCPAO [default: 200]")
    p.add_argument("--out",          type=str,   default=None,
                   help="Save results to CSV file")
    p.add_argument("--cache",        type=str,   default=".pcpao_cache.json",
                   help="Local cache file for PCPAO responses")
    return p.parse_args()

# ── Step 1: Download tax deed CSV ─────────────────────────────────────────────

def fetch_tax_deed_list() -> pd.DataFrame:
    """
    Download the Polk County Tax Deed Applications CSV.
    Falls back to a local file named 'taxdeedapps.csv' if the download fails.
    """
    print("📥  Downloading tax deed applications list …")
    try:
        r = requests.get(TAX_DEED_CSV_URL, headers=HEADERS, timeout=30)
        r.raise_for_status()
        from io import StringIO
        df = pd.read_csv(StringIO(r.text), dtype=str)
        print(f"    ✓ {len(df):,} records downloaded")
        return df
    except Exception as e:
        local = Path("taxdeedapps.csv")
        if local.exists():
            print(f"    ⚠ Download failed ({e}). Using local {local}")
            return pd.read_csv(local, dtype=str)
        sys.exit(
            f"\n❌  Could not download or find taxdeedapps.csv.\n"
            f"    Download manually from:\n"
            f"    https://www.polktaxes.com/file-download-requests/\n"
            f"    and place it in the current directory.\n"
            f"    Original error: {e}"
        )

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column names — the county may rename them at any time.
    We try to map to standard names regardless of exact header spelling.
    """
    col_map = {}
    for col in df.columns:
        c = col.strip().lower().replace(" ", "_")
        if "parcel" in c:                          col_map[col] = "parcel_id"
        elif "address" in c and "mail" not in c:   col_map[col] = "address"
        elif "redemp" in c:                         col_map[col] = "redemption_amount"
        elif "purchase" in c or "bid" in c:         col_map[col] = "purchase_price"
        elif "status" in c:                         col_map[col] = "status"
        elif "sale_date" in c or "auction" in c:   col_map[col] = "sale_date"
        elif "case" in c:                           col_map[col] = "case_number"
        elif "homestead" in c:                      col_map[col] = "homestead"
    df = df.rename(columns=col_map)
    # Ensure required columns exist
    for req in ["parcel_id", "purchase_price"]:
        if req not in df.columns:
            print(f"    ⚠ Could not find '{req}' column. Columns found: {list(df.columns)}")
    return df

def clean_money(val) -> float:
    if pd.isna(val):
        return 0.0
    return float(re.sub(r"[^0-9.]", "", str(val)) or 0)

# ── Step 2: PCPAO lookup ──────────────────────────────────────────────────────

def load_cache(path: str) -> dict:
    p = Path(path)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}

def save_cache(cache: dict, path: str):
    Path(path).write_text(json.dumps(cache, indent=2))

def fetch_pcpao(parcel_id: str, session: requests.Session) -> dict:
    """
    Fetch assessed value data from PCPAO for a given parcel ID.
    """
    # Strip all non-alphanumeric characters from parcel id
    pid = re.sub(r"[^0-9A-Za-z]", "", parcel_id)

    try:
        # PCPAO uses a direct path approach for details
        url = f"{PCPAO_PARCEL}{pid}"
        r = session.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        def find_value(label_text: str) -> float:
            """Find a $ value next to a label on the PCPAO page."""
            label = soup.find(string=re.compile(label_text, re.I))
            if not label:
                return 0.0
            parent = label.find_parent()
            if parent:
                # Try next sibling td or span
                sibling = parent.find_next_sibling()
                if sibling:
                    return clean_money(sibling.get_text())
            return 0.0

        def find_text(label_text: str) -> str:
            label = soup.find(string=re.compile(label_text, re.I))
            if not label:
                return ""
            parent = label.find_parent()
            if parent:
                sibling = parent.find_next_sibling()
                if sibling:
                    return sibling.get_text(strip=True)
            return ""

        result = {
            "land_value":        find_value(r"LAND VALUE"),
            "building_value":    find_value(r"BUILDING VALUE"),
            "just_market_value": find_value(r"JUST MARKET VALUE"),
            "dor_code":          find_text(r"DOR.*Code|Use Code"),
            "dor_description":   find_text(r"Property.*Use"),
            "pcpao_address":     find_text(r"Physical.*Address|Street"),
        }
        return result

    except Exception as e:
        print(f"        ⚠ PCPAO lookup failed for {parcel_id}: {e}")
        return None

# ── Step 3: Score & filter ────────────────────────────────────────────────────

def score_deal(row: dict) -> float:
    """
    Simple deal score 0–100:
      50 pts  equity ratio (how far below market)
      20 pts  has building (not vacant land)
      15 pts  OTC / List of Lands (no auction competition)
      15 pts  no homestead (simpler title)
    """
    score = 0.0
    jmv = row.get("just_market_value", 0)
    price = row.get("purchase_price_num", 0)

    if jmv > 0 and price > 0:
        equity = (jmv - price) / jmv
        score += min(equity, 1.0) * 50

    if row.get("building_value", 0) > 0:
        score += 20

    status = str(row.get("status", "")).upper()
    if "LIST OF LANDS" in status or "AVAILABLE" in status:
        score += 15

    homestead = str(row.get("homestead", "")).upper()
    if homestead in ("NO", "N", "FALSE", "0", ""):
        score += 15

    return round(score, 1)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # 1. Get tax deed list
    df = fetch_tax_deed_list()
    df = normalize_columns(df)

    # Clean purchase price
    df["purchase_price_num"] = df.get("purchase_price", pd.Series(dtype=str)).apply(clean_money)

    # Apply price filter early to reduce PCPAO calls
    if args.max_price:
        df = df[df["purchase_price_num"] <= args.max_price]
        print(f"    → {len(df):,} properties under ${args.max_price:,.0f}")

    # OTC filter
    if args.otc_only and "status" in df.columns:
        mask = df["status"].str.upper().str.contains("LIST OF LANDS|AVAILABLE", na=False)
        df = df[mask]
        print(f"    → {len(df):,} OTC / List of Lands properties")

    # Limit PCPAO calls
    lookup_df = df.head(args.max_parcels).copy()
    print(f"\n🔍  Looking up {len(lookup_df):,} parcels on PCPAO …")

    # 2. PCPAO enrichment
    cache = load_cache(args.cache)
    session = requests.Session()
    pcpao_rows = []

    for i, (_, row) in enumerate(lookup_df.iterrows(), 1):
        parcel_id = str(row.get("parcel_id", "")).strip()
        if not parcel_id:
            continue

        if parcel_id in cache:
            pcpao_data = cache[parcel_id]
        else:
            print(f"  [{i:>3}/{len(lookup_df)}] {parcel_id} …", end=" ", flush=True)
            pcpao_data = fetch_pcpao(parcel_id, session)
            if pcpao_data:
                cache[parcel_id] = pcpao_data
                save_cache(cache, args.cache)
                print(f"JMV=${pcpao_data['just_market_value']:>8,.0f}  "
                      f"Bldg=${pcpao_data['building_value']:>8,.0f}")
            else:
                print("failed")
            time.sleep(RATE_LIMIT)

        if pcpao_data:
            combined = {**row.to_dict(), **pcpao_data}
            combined["score"] = score_deal(combined)
            pcpao_rows.append(combined)

    if not pcpao_rows:
        print("\n❌  No results enriched from PCPAO. Check network or try again.")
        sys.exit(1)

    results = pd.DataFrame(pcpao_rows)

    # 3. Filter
    # Equity ratio
    results["equity_ratio"] = (
        (results["just_market_value"] - results["purchase_price_num"])
        / results["just_market_value"].replace(0, float("nan"))
    ).fillna(0)

    results = results[results["equity_ratio"] >= args.min_equity]

    if args.no_vacant:
        results = results[results["building_value"] > 0]

    # 4. Sort by score descending
    results = results.sort_values("score", ascending=False)

    # 5. Display
    display_cols = [
        "case_number", "parcel_id", "address",
        "purchase_price_num", "just_market_value", "building_value",
        "equity_ratio", "status", "score"
    ]
    display_cols = [c for c in display_cols if c in results.columns]
    display = results[display_cols].copy()

    # Format numbers for readability
    for col in ["purchase_price_num", "just_market_value", "building_value"]:
        if col in display.columns:
            display[col] = display[col].apply(lambda x: f"${x:,.0f}")
    if "equity_ratio" in display.columns:
        display["equity_ratio"] = display["equity_ratio"].apply(lambda x: f"{x:.0%}")

    display = display.rename(columns={
        "purchase_price_num": "price",
        "just_market_value":  "mkt_value",
        "building_value":     "bldg_value",
        "equity_ratio":       "equity",
    })

    print(f"\n{'='*80}")
    print(f"  🏠  {len(display)} deals found  (score = equity + building + OTC + no-homestead)")
    print(f"{'='*80}\n")

    if len(display) > 0:
        print(tabulate(display, headers="keys", tablefmt="rounded_outline", showindex=False))
    else:
        print("  No deals matched your filters. Try relaxing --min-equity or removing --no-vacant.")

    # 6. Save
    if args.out:
        results.to_csv(args.out, index=False)
        print(f"\n💾  Full results saved to {args.out}")

    print(f"\n💡  Tips:")
    print(f"    • Always verify building_value > 0 before getting excited")
    print(f"    • Check HOA status for any condo (DOR code 04xxx)")
    print(f"    • Budget $1,500–$3,500 for quiet title after any tax deed purchase")
    print(f"    • Call Polk County Clerk: (863) 534-4516 to confirm OTC availability\n")

if __name__ == "__main__":
    main()
