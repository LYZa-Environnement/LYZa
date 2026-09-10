"""Example: score a list of addresses in bulk and get a pandas DataFrame back.

This is the entry point for the more analytical work planned later (parcel
screening for a due-diligence mission, comparing several sites, exporting a
map layer). It reuses the exact same `app.geocode` / `app.synthesis` code
the web API uses — there is only one implementation of the scoring logic.

Run with: python -m app.analytics.batch_scoring addresses.csv
(a CSV with one column named 'adresse')
"""

import asyncio
import sys

import httpx
import pandas as pd

from app.geocode import search_addresses
from app.synthesis import build_sensitivity_report


async def score_addresses(addresses: list[str], rayon_metres: int = 500) -> pd.DataFrame:
    rows = []
    async with httpx.AsyncClient() as client:
        for raw_address in addresses:
            matches = await search_addresses(client, raw_address, limit=1)
            if not matches:
                rows.append({"adresse_saisie": raw_address, "statut": "non géocodée"})
                continue

            best_match = matches[0]
            report = await build_sensitivity_report(client, best_match, rayon_metres)
            row = {
                "adresse_saisie": raw_address,
                "adresse_trouvee": best_match.label,
                "lat": best_match.lat,
                "lon": best_match.lon,
                "niveau_global": report.niveau_global,
                "statut": "ok",
            }
            row.update({f"niveau_{theme.key}": theme.niveau for theme in report.themes})
            rows.append(row)

    return pd.DataFrame(rows)


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m app.analytics.batch_scoring addresses.csv")
        raise SystemExit(1)

    input_csv = pd.read_csv(sys.argv[1])
    addresses = input_csv["adresse"].dropna().tolist()
    result = asyncio.run(score_addresses(addresses))
    output_path = sys.argv[1].rsplit(".", 1)[0] + "_scored.csv"
    result.to_csv(output_path, index=False)
    print(f"{len(result)} adresse(s) traitée(s) -> {output_path}")


if __name__ == "__main__":
    main()
