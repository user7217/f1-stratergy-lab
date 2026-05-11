import math
import pathlib
import pickle
import fastf1
import pandas as pd
import numpy as np
from functools import lru_cache
from typing import Optional

# Use relative imports (the dot)
from .config import TRACK_CATEGORIES, CATEGORIES, REF_TRACK_TEMP
from .utils import to_seconds, safe_float, _get_safe_session

# Keep your underscores here too
from .telemetry import (
    _compute_push_scores, _compute_dirty_air_laps, _stint_degradation, 
    _compute_downforce_index, _compute_preservation_ranking
)

@lru_cache(maxsize=32)
def _get_race_results(year: int, race: str) -> list[dict]:
    session = fastf1.get_session(year, race, 'R')
    session.load(telemetry=False, weather=False, messages=False)
    res = session.results
    processed = []
    for _, row in res.iterrows():
        processed.append({
            "driver_number": str(row["DriverNumber"]),
            "position": row["Position"],
            "grid": row["GridPosition"],
            "points": row["Points"],
            "status": str(row["Status"]),
            "team": str(row["TeamName"]),
            "abbreviation": str(row.get("Abbreviation", ""))
        })
    return processed

def _get_driver_laps(year: int, race: str, driver: str) -> list[dict]:
    try:
        session = _get_safe_session(year, race, 'R', telemetry=False)
    except Exception as e:
        return []
        
    laps = session.laps.pick_drivers(driver)
    processed = []
    
    for _, row in laps.iterrows():
        processed.append({
            "lap": safe_float(row.get("LapNumber")),
            "lap_time": to_seconds(row.get("LapTime")),
            "position": safe_float(row.get("Position")),           # NEW: Lap Position
            "pit_in": pd.notna(row.get("PitInTime")),              # NEW: Pit Stop Flag
            "sector_1": to_seconds(row.get("Sector1Time")),
            "sector_2": to_seconds(row.get("Sector2Time")),
            "sector_3": to_seconds(row.get("Sector3Time")),
            "compound": str(row.get("Compound", "UNKNOWN")),
            "tyre_life": safe_float(row.get("TyreLife"))
        })
    return processed

@lru_cache(maxsize=32)
def _get_qualifying_analytics(year: int, race: str, session_type: str) -> dict:
    try:
        session = _get_safe_session(year, race, session_type)
        laps = session.laps
        results = session.results
        
        # Explicitly catch the FastF1 DataNotLoadedError
        try:
            t0 = session.t0_date
        except Exception:
            t0 = None
            
    except Exception as e:
        return {"error": str(e)}

    def _sec(val):
        return to_seconds(val, t0)

    fastest = laps.pick_fastest() if not laps.empty else pd.Series(dtype=float)
    drv_val = fastest.get('Driver')
    overall_fastest = {
        "driver": str(drv_val) if pd.notna(drv_val) else "N/A", 
        "time": _sec(fastest.get('LapTime'))
    }

    sectors = {}
    for i in range(1, 4):
        col = f'Sector{i}Time'
        if not laps.empty and col in laps.columns:
            valid = laps.dropna(subset=[col])
            if not valid.empty:
                idx = valid[col].idxmin()
                sectors[f"s{i}"] = {
                    "driver": str(valid.loc[idx, 'Driver']),
                    "time": _sec(valid.loc[idx, col])
                }

    try:
        rc = session.race_control_messages
    except Exception:
        rc = None

    incidents = []
    if rc is not None and not rc.empty:
        for _, row in rc.iterrows():
            msg = str(row['Message']).lower()
            if any(k in msg for k in ['flag', 'incident', 'track limit', 'deleted']):
                incidents.append({
                    "time": _sec(row.get('Time')), 
                    "message": str(row['Message'])
                })

    driver_results = []
    driver_attempts = {}

    for _, row in results.iterrows():
        drv = str(row['DriverNumber'])
        abbrev = str(row.get('Abbreviation', drv))

        driver_results.append({
            "abbreviation": abbrev,
            "position": safe_float(row.get('Position')),
            "team": str(row.get('TeamName', '')),
            "q1": _sec(row.get('Q1')),
            "q2": _sec(row.get('Q2')),
            "q3": _sec(row.get('Q3')),
        })

        drv_laps = laps.pick_drivers(drv).pick_quicklaps() if not laps.empty else pd.DataFrame()
        attempts = []
        if not drv_laps.empty:
            for _, lap in drv_laps.iterrows():
                if pd.notna(lap.get('LapTime')):
                    attempts.append({
                        "lap": safe_float(lap.get('LapNumber')),
                        "time": _sec(lap.get('LapTime')),
                        "s1": _sec(lap.get('Sector1Time')),
                        "s2": _sec(lap.get('Sector2Time')),
                        "s3": _sec(lap.get('Sector3Time')),
                        "compound": str(lap.get('Compound', ''))
                    })
        driver_attempts[abbrev] = attempts

    return {
        "session_type": session_type,
        "overall_fastest": overall_fastest,
        "overall_sectors": sectors,
        "incidents": incidents,
        "results": sorted(driver_results, key=lambda x: x['position'] or 999),
        "attempts": driver_attempts
    }


@lru_cache(maxsize=32)
def _get_session_overview(year: int, race: str, session_type: str = 'R') -> dict:
    if session_type in ['Q', 'SQ']:
        return _get_qualifying_analytics(year, race, session_type)

    try:
        session = _get_safe_session(year, race, session_type)
        laps = session.laps
        results = session.results
        total_laps = int(laps['LapNumber'].max()) if not laps.empty and 'LapNumber' in laps.columns else 0
        try:
            t0 = session.t0_date
        except Exception:
            t0 = None
    except Exception as e:
        return {"error": str(e)}

    strategies = {}
    consistency = []
    positions_delta = []
    start_performance = []
    speeds = []
    dnfs = []

    fastest_overall = laps.pick_fastest() if not laps.empty else pd.Series(dtype=float)
    drv_val = fastest_overall.get('Driver')
    overall_fastest_lap = {
        "driver": str(drv_val) if pd.notna(drv_val) else "N/A",
        "time": to_seconds(fastest_overall.get('LapTime'), t0)
    }



    try:
        rc = session.race_control_messages
    except Exception:
        rc = None

    incidents = []
    if rc is not None and not rc.empty:
        for _, row in rc.iterrows():
            msg = str(row['Message']).lower()
            if any(k in msg for k in ['flag', 'incident', 'investigation', 'penalty', 'safety car']):
                incidents.append({
                    "time": to_seconds(row.get('Time'), t0), 
                    "message": str(row['Message'])
                })

    laps_1 = laps[laps['LapNumber'] == 1.0] if not laps.empty and 'LapNumber' in laps.columns else pd.DataFrame()

    for _, row in results.iterrows():
        drv = str(row['DriverNumber'])
        abbrev = str(row.get('Abbreviation', drv))
        team = str(row.get('TeamName', ''))
        grid = safe_float(row.get('GridPosition'))
        finish = safe_float(row.get('Position'))
        pts = safe_float(row.get('Points', 0.0))
        status = str(row.get('Status', ''))

        if not status.startswith("Finished") and not status.startswith("+"):
            dnfs.append({
                "driver": drv, "abbreviation": abbrev, "team": team,
                "reason": status, "laps_completed": int(row['Laps']) if pd.notna(row.get('Laps')) else 0
            })

        if grid and finish and grid > 0:
            positions_delta.append({
                "abbreviation": abbrev, "gained": int(grid - finish), "team": team, "finish": int(finish), "points": pts
            })

        if grid and grid > 0 and not laps_1.empty:
            l1 = laps_1[laps_1['DriverNumber'] == drv]
            if not l1.empty:
                pos_l1 = safe_float(l1.iloc[0]['Position'])
                if pos_l1:
                    start_performance.append({
                        "abbreviation": abbrev, "grid": int(grid), "lap1_pos": int(pos_l1), "delta": int(grid - pos_l1)
                    })

        drv_laps = laps.pick_drivers(drv)
        if drv_laps.empty:
            continue

        stints = []
        for stint_num, stint_laps in drv_laps.groupby("Stint"):
            stints.append({
                "stint": int(stint_num),
                "compound": str(stint_laps["Compound"].iloc[0]),
                "laps": len(stint_laps)
            })
        strategies[abbrev] = stints

        clean_laps = drv_laps.pick_quicklaps()
        if not clean_laps.empty and len(clean_laps) > 3:
            std_dev = clean_laps['LapTime'].dt.total_seconds().std()
            consistency.append({
                "driver": drv, "abbreviation": abbrev, "variance": float(std_dev) if pd.notna(std_dev) else 0
            })

        if 'SpeedST' in drv_laps.columns:
            max_speed = drv_laps['SpeedST'].max()
            if pd.notna(max_speed):
                speeds.append({
                    "driver": drv, "abbreviation": abbrev, "speed": float(max_speed)
                })

    return {
        "session_type": session_type,
        "total_laps": total_laps,
        "overall_fastest": overall_fastest_lap,
        "incidents": incidents,
        "results": sorted(positions_delta, key=lambda x: x['finish']), 
        "strategies": strategies,
        "dnfs": dnfs,
        "speeds": sorted(speeds, key=lambda x: x['speed'], reverse=True),
        "start_performance": sorted(start_performance, key=lambda x: x['delta'], reverse=True),
        "consistency": sorted([c for c in consistency if c['variance'] > 0], key=lambda x: x['variance'])
    }


    


@lru_cache(maxsize=16)
def _get_tyre_degradation(year: int, race, telemetry: bool = True) -> dict:
    session = _get_safe_session(year, race, 'R', telemetry=telemetry)
    laps    = session.laps
    results = session.results

    drv_team   = {str(r['DriverNumber']): str(r['TeamName'])   for _, r in results.iterrows()}
    drv_abbrev = {str(r['DriverNumber']): str(r['Abbreviation']) for _, r in results.iterrows()}

    # compute session-level context once
    push_scores_all = _compute_push_scores(session) if telemetry else {}
    dirty_air_all   = _compute_dirty_air_laps(session)
    downforce_idx   = _compute_downforce_index(session) if telemetry else {}

    # mean track temp for the session
    mean_track_temp = REF_TRACK_TEMP
    try:
        wx = session.weather_data
        if wx is not None and not wx.empty and 'TrackTemp' in wx.columns:
            mean_track_temp = float(wx['TrackTemp'].mean())
    except Exception:
        pass

    stints = []
    total_race_laps = int(laps['LapNumber'].max()) if 'LapNumber' in laps.columns else 0 

    for drv in session.drivers:
        drv_laps = laps.pick_drivers(drv)
        if drv_laps.empty:
            continue

        team   = drv_team.get(drv, "Unknown")
        abbrev = drv_abbrev.get(drv, drv)
        drv_push = push_scores_all.get(drv, [])
        drv_dirty = dirty_air_all.get(str(drv), set())
        df_idx = downforce_idx.get(str(drv), 1.0)

        for stint_num, sl in drv_laps.groupby("Stint"):
            compound = str(sl["Compound"].iloc[0])
            if compound in ("UNKNOWN", "nan", ""):
                continue

            # slice push scores to this stint's lap indices
            stint_lap_nums  = sl['LapNumber'].tolist()
            all_lap_nums    = drv_laps['LapNumber'].tolist()
            stint_push = []
            for ln in stint_lap_nums:
                try:
                    idx = all_lap_nums.index(ln)
                    stint_push.append(drv_push[idx] if idx < len(drv_push) else None)
                except (ValueError, IndexError):
                    stint_push.append(None)
                   

            deg = _stint_degradation(
                sl, stint_push, drv_dirty,
                mean_track_temp, compound, total_race_laps
            )
            if deg is None:
                continue

            stints.append({
                "driver":          drv,
                "abbreviation":    abbrev,
                "team":            team,
                "stint":           int(stint_num),
                "compound":        compound,
                "downforce_index": round(df_idx, 3),
                **deg,
            })

    # per-race tyre preservation ranking
    preservation = _compute_preservation_ranking(stints)

    return {
        "year":         year,
        "race":         race,
        "track_temp":   mean_track_temp,
        "stints":       stints,
        "preservation": preservation,
    }




@lru_cache(maxsize=8)
def _get_season_performance(year: int) -> dict:
    schedule = fastf1.get_event_schedule(year)
    now = pd.Timestamp.now()
    completed = schedule[(schedule['EventDate'] < now) & (schedule['EventFormat'] != 'testing')]

    drivers = {}
    teams = {}
    races = []

    

    def calc_std_dev(values):
        valid = [v for v in values if v is not None]
        if not valid or len(valid) < 2: return 0.0
        mean = sum(valid) / len(valid)
        return round(math.sqrt(sum((x - mean) ** 2 for x in valid) / len(valid)), 2)

    for race_idx, event in enumerate(completed.iterrows()):
        _, event_data = event
        try:
            session = fastf1.get_session(year, event_data['RoundNumber'], 'R')
            session.load(telemetry=False, weather=False, messages=False, laps=False)
            
            race_name = str(event_data['EventName']).replace(" Grand Prix", "")
            loc = str(event_data.get('Location', ''))
            t_type = TRACK_CATEGORIES.get(loc, 'Mixed')
            races.append(race_name)
            
            for d in drivers.values():
                while len(d["grids"]) < len(races): d["grids"].append(None)
                while len(d["finishes"]) < len(races): d["finishes"].append(None)
                while len(d["points_timeline"]) < len(races): d["points_timeline"].append(d["points_timeline"][-1] if d["points_timeline"] else 0)
            
            for t in teams.values():
                while len(t["points_timeline"]) < len(races): t["points_timeline"].append(t["points_timeline"][-1] if t["points_timeline"] else 0)

            for _, row in session.results.iterrows():
                drv = str(row['Abbreviation'])
                team = str(row['TeamName'])
                grid = safe_float(row.get('GridPosition'), 0)
                finish = safe_float(row.get('Position'), 0)
                pts = safe_float(row.get('Points'), 0)
                status = str(row.get('Status', ''))

                if drv not in drivers:
                    drivers[drv] = {
                        "team": team, "points": 0, "wins": 0, "podiums": 0, "poles": 0,
                        "dnfs": 0, "grids": [None] * (len(races) - 1), "finishes": [None] * (len(races) - 1), 
                        "gained_total": 0, "points_timeline": [0] * (len(races) - 1), 
                        "cat_perf": {c: {"points": 0, "positions": [], "races": 0} for c in CATEGORIES}
                    }
                
                if team not in teams:
                    teams[team] = {
                        "points": 0, "wins": 0, "podiums": 0, "poles": 0, "dnfs": 0,
                        "grids": [], "finishes": [], "drivers": set(),
                        "points_timeline": [0] * (len(races) - 1), 
                        "cat_perf": {c: {"points": 0, "positions": [], "races": 0} for c in CATEGORIES}
                    }
                
                d = drivers[drv]
                t = teams[team]
                
                d["points"] += pts
                t["points"] += pts
                t["drivers"].add(drv)
                
                if grid > 0: 
                    d["grids"].append(grid)
                    t["grids"].append(grid)
                else: 
                    d["grids"].append(None)
                
                if finish > 0: 
                    d["finishes"].append(finish)
                    t["finishes"].append(finish)
                else: 
                    d["finishes"].append(None)
                
                if grid == 1.0: 
                    d["poles"] += 1
                    t["poles"] += 1
                if finish == 1.0: 
                    d["wins"] += 1
                    t["wins"] += 1
                if finish in [1.0, 2.0, 3.0]: 
                    d["podiums"] += 1
                    t["podiums"] += 1
                if not status.startswith("Finished") and not status.startswith("+"): 
                    d["dnfs"] += 1
                    t["dnfs"] += 1
                
                if finish and finish > 0:
                    d["cat_perf"][t_type]["positions"].append(finish)
                    d["cat_perf"][t_type]["races"] += 1
                    t["cat_perf"][t_type]["positions"].append(finish)
                    t["cat_perf"][t_type]["races"] += 1

                d["cat_perf"][t_type]["points"] += pts
                t["cat_perf"][t_type]["points"] += pts

                d["points_timeline"].append(d["points"])
                t["points_timeline"].append(t["points"])

        except Exception:
            continue

    driver_list = []
    for drv, data in drivers.items():
        valid_grids = [x for x in data["grids"] if x is not None]
        valid_finishes = [x for x in data["finishes"] if x is not None]
        
        avg_grid = sum(valid_grids) / len(valid_grids) if valid_grids else 0
        avg_finish = sum(valid_finishes) / len(valid_finishes) if valid_finishes else 0
        
        driver_list.append({
            "abbreviation": drv, "team": data["team"], "points": data["points"],
            "poles": data["poles"], "wins": data["wins"], "podiums": data["podiums"], "dnfs": data["dnfs"],
            "avg_grid": round(avg_grid, 2), "avg_finish": round(avg_finish, 2), "net_gained": int(data["gained_total"]),
            "quali_consistency": calc_std_dev(data["grids"]),
            "race_consistency": calc_std_dev(data["finishes"]),
            "grid_history": data["grids"],
            "finish_history": data["finishes"],
            "points_timeline": data["points_timeline"],
           "cat_perf": {
                c: {
                    "avg_points": round(data["cat_perf"][c]["points"] / data["cat_perf"][c]["races"], 2)
                                if data["cat_perf"][c]["races"] > 0 else 0,
                    "avg_finish": round(sum(data["cat_perf"][c]["positions"]) / len(data["cat_perf"][c]["positions"]), 1)
                                if data["cat_perf"][c]["positions"] else None,
                    "races": data["cat_perf"][c]["races"],
                    "total_points": data["cat_perf"][c]["points"],
                }
                for c in CATEGORIES
            },
        })

    team_list = []
    for tm, data in teams.items():
        avg_grid = sum(data["grids"]) / len(data["grids"]) if data["grids"] else 0
        avg_finish = sum(data["finishes"]) / len(data["finishes"]) if data["finishes"] else 0

        team_list.append({
            "team": tm, "points": data["points"], "points_timeline": data["points_timeline"],
            "wins": data["wins"], "podiums": data["podiums"], "poles": data["poles"], "dnfs": data["dnfs"],
            "avg_grid": round(avg_grid, 2), "avg_finish": round(avg_finish, 2),
            "drivers": list(data["drivers"]),
            # "track_perf_pts": {
            #     "High-Speed": sum(data["track_perf"]["High-Speed"]),
            #     "Technical": sum(data["track_perf"]["Technical"]),
            #     "Mixed": sum(data["track_perf"]["Mixed"])
            # },
            "cat_perf": {
                c: {
                    "avg_points": round(data["cat_perf"][c]["points"] / data["cat_perf"][c]["races"], 2)
                                if data["cat_perf"][c]["races"] > 0 else 0,
                    "avg_finish": round(sum(data["cat_perf"][c]["positions"]) / len(data["cat_perf"][c]["positions"]), 1)
                                if data["cat_perf"][c]["positions"] else None,
                    "races": data["cat_perf"][c]["races"],
                    "total_points": data["cat_perf"][c]["points"],
                }
                for c in CATEGORIES
            },
        })

    return {
        "races": races,
        "drivers": sorted(driver_list, key=lambda x: x['points'], reverse=True),
        "categories": CATEGORIES,
        "year": year,
        "teams": sorted(team_list, key=lambda x: x['points'], reverse=True)
    }


@lru_cache(maxsize=64)
def _get_circuit_data(year: int, race: str) -> dict:
    session = fastf1.get_session(year, race, 'R')
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    fastest = session.laps.pick_fastest()
    pos = fastest.get_pos_data()
    if pos.empty:
        raise ValueError("no position data for fastest lap")

    pos_t = pos['SessionTime'].dt.total_seconds().to_numpy()
    xs = pos['X'].to_numpy()
    ys = pos['Y'].to_numpy()

    def time_to_idx(t):
        if pd.isna(t):
            return None
        sec = t.total_seconds() if hasattr(t, 'total_seconds') else float(t)
        idx = int(np.searchsorted(pos_t, sec))
        return max(0, min(idx, len(pos_t) - 1))

    s1_idx = time_to_idx(fastest['Sector1SessionTime']) or len(pos_t) // 3
    s2_idx = time_to_idx(fastest['Sector2SessionTime']) or 2 * len(pos_t) // 3

    corners = []
    rotation = 0.0
    try:
        ci = session.get_circuit_info()
        if ci is not None:
            rotation = float(getattr(ci, 'rotation', 0) or 0)
            for _, c in ci.corners.iterrows():
                corners.append({
                    "number": int(c['Number']),
                    "letter": str(c.get('Letter', '') or ''),
                    "x": float(c['X']),
                    "y": float(c['Y']),
                    "angle": float(c['Angle']) if pd.notna(c.get('Angle')) else 0.0,
                })
    except Exception:
        pass

    points = [{"x": float(x), "y": float(y)} for x, y in zip(xs, ys)]
    return {
        "points": points,
        "sector_breaks": [s1_idx, s2_idx],
        "corners": corners,
        "rotation": rotation,
        "bounds": {
            "min_x": float(xs.min()), "max_x": float(xs.max()),
            "min_y": float(ys.min()), "max_y": float(ys.max()),
        },
    }



@lru_cache(maxsize=16)
def _get_season_races(year: int) -> list[dict]:
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    out = []
    for _, ev in schedule.iterrows():
        out.append({
            "round": int(ev["RoundNumber"]),
            "name": str(ev["EventName"]).replace(" Grand Prix", "").strip(),
            "full_name": str(ev["EventName"]),
            "country": str(ev.get("Country", "") or ""),
            "location": str(ev.get("Location", "") or ""),
            "date": str(ev.get("EventDate", ""))[:10],
            "format": str(ev.get("EventFormat", "conventional")),
        })
    return out





@lru_cache(maxsize=4)
def _get_season_tyre_analysis(year: int) -> dict:
    """
    Aggregates per-race tyre preservation scores across the season.
    Per team: overall preservation, per compound, per track category.
    """
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    now      = pd.Timestamp.now()
    done     = schedule[schedule['EventDate'] < now]

    # {team: {compound: {category: [scores]}}}
    team_data: dict = {}

    races_processed = []

    for _, ev in done.iterrows():
        race_name = str(ev['EventName']).replace(" Grand Prix", "")
        loc       = str(ev.get('Location', ''))
        category  = TRACK_CATEGORIES.get(loc, 'Mixed')

        try:
            data = _get_tyre_degradation(year, int(ev['RoundNumber']), telemetry=False)
        except Exception:
            continue

        races_processed.append(race_name)

        for entry in data.get("preservation", []):
            team     = entry["team"]
            score    = entry["preservation_score"]
            push     = entry["avg_push_score"]
            by_comp  = entry["by_compound"]

            if team not in team_data:
                team_data[team] = {
                    "overall":    [],
                    "by_compound": {},
                    "by_category": {c: [] for c in CATEGORIES},
                    "by_cat_compound": {},
                }

            td = team_data[team]
            td["overall"].append(score)
            td["by_category"][category].append(score)

            for comp, comp_score in by_comp.items():
                td["by_compound"].setdefault(comp, []).append(comp_score)

                cat_key = f"{category}_{comp}"
                td["by_cat_compound"].setdefault(cat_key, []).append(comp_score)

    # summarise
    def _summarise(scores: list[float]) -> Optional[dict]:
        if not scores:
            return None
        arr = np.array(scores)
        return {
            "mean":   round(float(arr.mean()), 4),
            "std":    round(float(arr.std()), 4),
            "n":      len(scores),
            "best":   round(float(arr.max()), 4),
            "worst":  round(float(arr.min()), 4),
        }

    summary = []
    for team, td in team_data.items():
        by_comp_summary = {
            comp: _summarise(scores)
            for comp, scores in td["by_compound"].items()
        }
        by_cat_summary = {
            cat: _summarise(scores)
            for cat, scores in td["by_category"].items()
            if scores
        }
        by_cat_comp_summary = {
            key: _summarise(scores)
            for key, scores in td["by_cat_compound"].items()
            if scores
        }
        overall = _summarise(td["overall"])
        if not overall:
            continue

        summary.append({
            "team":             team,
            "overall":          overall,
            "by_compound":      by_comp_summary,
            "by_category":      by_cat_summary,
            "by_cat_compound":  by_cat_comp_summary,
        })

    # global rankings
    ranked_overall = sorted(
        [s for s in summary if s["overall"]],
        key=lambda x: x["overall"]["mean"],
        reverse=True,
    )

    # best compound per team — which compound do they manage best
    best_compound_per_team = {}
    for s in summary:
        if not s["by_compound"]:
            continue
        best = max(s["by_compound"].items(),
                   key=lambda x: x[1]["mean"] if x[1] else -999)
        best_compound_per_team[s["team"]] = {
            "compound": best[0],
            "score":    best[1]["mean"] if best[1] else None,
        }

    # best category per team — which track type suits their tyre management
    best_category_per_team = {}
    for s in summary:
        if not s["by_category"]:
            continue
        valid = {k: v for k, v in s["by_category"].items() if v and v["n"] >= 2}
        if not valid:
            continue
        best = max(valid.items(), key=lambda x: x[1]["mean"])
        best_category_per_team[s["team"]] = {
            "category": best[0],
            "score":    best[1]["mean"],
        }

    return {
        "year":                   year,
        "races":                  races_processed,
        "team_summary":           ranked_overall,
        "best_compound_per_team": best_compound_per_team,
        "best_category_per_team": best_category_per_team,
    }
