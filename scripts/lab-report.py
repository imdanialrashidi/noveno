#!/usr/bin/env python3
"""Extract median Lighthouse metrics from a benchmark sweep directory."""
import json
import statistics
import sys
from pathlib import Path


def median(vals):
    return statistics.median(vals) if vals else float("nan")


def extract(sweep_dir):
    out = {}
    for f in sorted(Path(sweep_dir).glob("*.json")):
        name = f.stem  # e.g. mobile_-1, desktop_audit-2
        profile = name.split("_")[0]
        route = name.split("_", 1)[1].rsplit("-", 1)[0]
        if route == "-":
            route = "/"
        d = json.loads(f.read_text())
        a = d["audits"]
        def n(k):
            v = a[k].get("numericValue")
            return round(v) if isinstance(v, (int, float)) else float("nan")
        rs = {i["resourceType"]: i for i in a["resource-summary"]["details"]["items"]}
        entry = {
            "score": d["categories"]["performance"]["score"],
            "fcp": n("first-contentful-paint"),
            "lcp": n("largest-contentful-paint"),
            "cls": n("cumulative-layout-shift"),
            "tbt": n("total-blocking-time"),
            "si": n("speed-index"),
            "bytes": rs["total"]["transferSize"],
            "reqs": rs["total"]["requestCount"],
            "font": rs.get("font", {}).get("transferSize", 0),
            "image": rs.get("image", {}).get("transferSize", 0),
        }
        out.setdefault((profile, route), []).append(entry)
    return out


def summarize(sweep_dir):
    data = extract(sweep_dir)
    rows = {}
    for (profile, route), runs in data.items():
        keys = list(runs[0].keys())
        rows[(profile, route)] = {k: median([r[k] for r in runs]) for k in keys}
    return rows


if __name__ == "__main__":
    rows = summarize(sys.argv[1])
    for (profile, route), m in sorted(rows.items()):
        print(
            f"{profile:7s} {route:20s} score={m['score']:.2f} FCP={m['fcp']:5.0f} "
            f"LCP={m['lcp']:5.0f} CLS={m['cls']:.3f} TBT={m['tbt']:4.0f} SI={m['si']:5.0f} "
            f"bytes={m['bytes']/1024:6.1f}K reqs={m['reqs']:2.0f} font={m['font']/1024:5.1f}K img={m['image']/1024:5.1f}K"
        )
