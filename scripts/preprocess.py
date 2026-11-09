"""Rebuild the compact, local Rally Atlas dataset from pinned ShuttleSet CSVs."""
import argparse
import ast
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"
REVISION = "45517f7d4cb936b03f3eabf939cc7959d39226fe"
SOURCE = f"https://raw.githubusercontent.com/wywyWang/CoachAI-Projects/{REVISION}"
MATCH_IDS = (11, 14, 15, 16, 24, 26, 27, 39)
# Match 39 is a Group A fixture. The upstream match.csv labels it as a quarter-final.
ROUND_CORRECTIONS = {39: "Group A (round robin)"}
NAMES = {
    "CHOU Tien Chen": "Chou Tien Chen",
    "Jonatan CHRISTIE": "Jonatan Christie",
    "Anders ANTONSEN": "Anders Antonsen",
    "Anthony Sinisuka GINTING": "Anthony Sinisuka Ginting",
    "Viktor AXELSEN": "Viktor Axelsen",
    "Rasmus GEMKE": "Rasmus Gemke",
    "LEE Zii Jia": "Lee Zii Jia",
}
SHOTS = {
    "放小球": "Net shot", "擋小球": "Return net", "殺球": "Smash",
    "點扣": "Wrist smash", "挑球": "Lob", "防守回挑": "Defensive return lob",
    "長球": "Clear", "平球": "Drive", "小平球": "Driven flight",
    "後場抽平球": "Back-court drive", "切球": "Drop", "過渡切球": "Passive drop",
    "過度切球": "Passive drop", "推球": "Push", "撲球": "Rush",
    "防守回抽": "Defensive return drive", "勾球": "Cross-court net shot",
    "發短球": "Short service", "發長球": "Long service",
}
TYPES = sorted(set(SHOTS.values()))
CORNERS = ("upleft", "upright", "downleft", "downright")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def project(matrix, x, y):
    a, b, w = (sum(coef * value for coef, value in zip(row, (x, y, 1)))
               for row in matrix)
    require(abs(w) > 1e-9, "Homography has a zero projective divisor")
    return a / w, b / w


def make_calibration(row):
    matrix = ast.literal_eval(row["homography_matrix"])
    tl, tr, bl, br = [project(matrix, float(row[f"{corner}_x"]), float(row[f"{corner}_y"]))
                      for corner in CORNERS]
    require(tl[0] < tr[0] and tl[1] < bl[1], "Unexpected corner orientation")
    require(math.dist((tr[0], bl[1]), br) < 0.02
            and abs(tl[1] - tr[1]) < 0.02 and abs(tl[0] - bl[0]) < 0.02,
            "Projected court corners do not form the documented rectangle")

    def to_court(x, y):
        u, v = project(matrix, x, y)
        # Rotate the diagram clockwise for a horizontal court. Camera bottom is left.
        return ((bl[1] - v) / (bl[1] - tl[1]) * 1340,
                (u - tl[0]) / (tr[0] - tl[0]) * 610)

    expected = ((1340, 0), (1340, 610), (0, 0), (0, 610))
    require(all(math.dist(to_court(float(row[f"{c}_x"]), float(row[f"{c}_y"])), p) < 0.05
                for c, p in zip(CORNERS, expected)), "Court corner check failed")
    return to_court


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def fetch(relative, filename, refresh=False):
    path = CACHE / filename
    if refresh or not path.exists():
        with urlopen(f"{SOURCE}/{quote(relative)}", timeout=45) as response:
            content = response.read()
        path.write_bytes(content)
    return path, {"path": relative, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def is_flagged(row):
    return row["flaw"].strip() == "1"


def position(row, prefix, calibrate, quality):
    raw = [row[f"{prefix}_{axis}"].strip() for axis in "xy"]
    if not all(raw):
        quality[f"missing_{prefix}"] += 1
        return None
    x, y = map(float, raw)
    require(math.isfinite(x) and math.isfinite(y), f"Non-finite coordinate in {prefix}")
    point = calibrate(x, y)
    require(all(math.isfinite(v) for v in point), f"Non-finite projection in {prefix}")
    return [round(v, 1) for v in point]


def parse_set(path, match_id, set_no, calibrate, quality):
    groups = defaultdict(list)
    for row in rows(path):
        require(row["player"] in ("A", "B"), f"Unknown player label in {path}")
        require(row["flaw"].strip() in ("", "1"), f"Unknown flaw flag in {path}")
        groups[int(row["rally"])].append(row)
        quality["source_rows"] += 1
    result = []
    for number, group in sorted(groups.items()):
        key = (match_id, set_no, number)
        require(number > 0, f"Invalid rally number in {key}")
        if all(map(is_flagged, group)):
            quality["all_flagged_rallies"] += 1
            quality["all_flagged_rows"] += len(group)
            continue
        if key == (24, 3, 25):
            tail = group[-1]
            require(is_flagged(tail) and float(tail["ball_round"]) == 1
                    and float(group[0]["ball_round"]) == 1 and group[-2]["getpoint_player"],
                    "Expected flagged trailing duplicate changed")
            group = group[:-1]
            quality["duplicate_rows"] += 1
        require([float(r["ball_round"]) for r in group] == list(range(1, len(group) + 1)),
                f"Non-consecutive stroke order in {key}")
        winners = {r["getpoint_player"].strip() for r in group if r["getpoint_player"].strip()}
        require(len(winners) <= 1 and winners <= {"A", "B"}, f"Ambiguous winner in {key}")
        winner = {"A": 0, "B": 1, None: None}[next(iter(winners), None)]
        if winner is None:
            quality["unknown_winner_rallies"] += 1
        scores = {(int(r["roundscore_A"]), int(r["roundscore_B"])) for r in group}
        require(len(scores) == 1 and all(0 <= s <= 30 for s in next(iter(scores))),
                f"Inconsistent score in {key}")
        strokes = []
        for row in group:
            shot = SHOTS.get(row["type"].strip())
            require(shot or row["type"].strip() == "未知球種", f"Unknown label in {key}")
            player = 0 if row["player"] == "A" else 1
            if is_flagged(row) or shot is None:
                quality["flagged_or_unclassified_slots"] += 1
                strokes.append([player, None, None, None, None])
                continue
            quality["classified_strokes"] += 1
            points = [position(row, k, calibrate, quality)
                      for k in ("landing", "player_location", "opponent_location")]
            strokes.append([player, TYPES.index(shot), *points])
        result.append({"n": number, "w": winner, "score": next(iter(scores)), "s": strokes})
    return {"n": set_no, "rallies": result}


def build(refresh):
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    prefix = "ShuttleSet/set"
    match_file, match_src = fetch(f"{prefix}/match.csv", "match.csv", refresh)
    hom_file, hom_src = fetch(f"{prefix}/homography.csv", "homography.csv", refresh)
    license_file, license_src = fetch("LICENSE", "LICENSE", refresh)
    (OUT / "SHUTTLESET-LICENSE.txt").write_bytes(license_file.read_bytes())
    metadata = [row for row in rows(match_file) if int(row["id"]) in MATCH_IDS]
    metadata.sort(key=lambda row: int(row["id"]))
    require(tuple(int(row["id"]) for row in metadata) == MATCH_IDS, "Match ID mismatch")
    homographies = {row["id"]: row for row in rows(hom_file)}
    requests = [(f"{prefix}/{row['video']}/set{n}.csv", f"{row['id']}-{n}.csv", refresh)
                for row in metadata for n in range(1, int(row["set"]) + 1)]
    with ThreadPoolExecutor(max_workers=8) as executor:
        downloaded = list(executor.map(lambda item: fetch(*item), requests))
    by_name = {path.name: path for path, _ in downloaded}
    matches = []
    quality = Counter()
    for row in metadata:
        key = row["id"]
        require(homographies[key]["video"] == row["video"], f"Calibration join mismatch for {key}")
        calibrate = make_calibration(homographies[key])
        sets = [parse_set(by_name[f"{key}-{n}.csv"], int(key), n, calibrate, quality)
                for n in range(1, int(row["set"]) + 1)]
        when = date(*(int(row[k]) for k in ("year", "month", "day"))).isoformat()
        matches.append({
            "id": int(key), "date": when, "event": row["tournament"],
            "round": ROUND_CORRECTIONS.get(int(key), row["round"]), "players": [NAMES[row["winner"]], NAMES[row["loser"]]],
            "sets": sets,
        })
    manifest = {
        "revision": REVISION, "quality": dict(quality),
        "sources": [match_src, hom_src, license_src, *(src for _, src in downloaded)],
    }
    (OUT / "shuttleset.json").write_text(
        json.dumps({"types": TYPES, "matches": matches, "quality": dict(quality)},
                   ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    (ROOT / "data" / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(manifest["quality"], indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Re-fetch every pinned input")
    build(parser.parse_args().refresh)
