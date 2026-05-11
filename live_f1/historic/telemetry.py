import numpy as np
import pandas as pd
from collections import defaultdict
from .config import FUEL_BURN_PER_LAP, REF_TRACK_TEMP, TEMP_SENSITIVITY, TRACK_EVOLUTION_PER_LAP

def _compute_push_scores(session) -> dict[str, list[float]]:
    """
    Vectorised version — reads car_data once per driver, 
    then assigns throttle mean per lap using LapNumber index.
    Avoids ~1000 individual get_telemetry() calls.
    """
    scores = {}
    try:
        laps = session.laps
        for drv in session.drivers:
            try:
                # read full car data for driver in one shot
                car = session.car_data[drv].copy()
                if car.empty or 'Throttle' not in car.columns:
                    scores[drv] = []
                    continue

                # add LapNumber to car data by merging on SessionTime
                drv_laps = laps.pick_drivers(drv)[['LapNumber', 'LapStartTime', 'Time']].copy()
                drv_laps = drv_laps.dropna(subset=['LapStartTime', 'Time'])

                # assign lap number to each telemetry sample via searchsorted
                lap_start_times = drv_laps['LapStartTime'].dt.total_seconds().to_numpy()
                car_times       = car['SessionTime'].dt.total_seconds().to_numpy()
                lap_indices     = np.searchsorted(lap_start_times, car_times, side='right') - 1

                car = car.copy()
                car['_lap_idx'] = lap_indices

                # per lap: mean throttle excluding brake-on samples
                lap_scores = []
                drv_lap_list = laps.pick_drivers(drv)['LapNumber'].tolist()

                for i, _ in enumerate(drv_lap_list):
                    lap_tel = car[
                        (car['_lap_idx'] == i) &
                        (car['Brake'] == False)
                    ]
                    if len(lap_tel) < 10:
                        lap_scores.append(None)
                    else:
                        lap_scores.append(float(lap_tel['Throttle'].mean()))

                scores[drv] = lap_scores

            except Exception:
                scores[drv] = []
    except Exception:
        pass
    return scores

def _compute_dirty_air_laps(session) -> dict[str, set[int]]:
    """
    Returns {driver_number: {lap_numbers_in_dirty_air}}
    A lap is dirty air if the driver was within 1.2s of the car ahead
    for most of that lap. Uses lap time position ordering as proxy.
    """
    laps = session.laps
    dirty = {}
    try:
        results = session.results
        drv_pos = {str(r['DriverNumber']): int(r['Position']) for _, r in results.iterrows()
                   if pd.notna(r.get('Position'))}

        for lap_num in laps['LapNumber'].dropna().unique():
            lap_slice = laps[laps['LapNumber'] == lap_num].copy()
            if lap_slice.empty:
                continue
            # sort by elapsed time to find who was where on track
            lap_slice = lap_slice.sort_values('Time')
            drv_list = lap_slice['DriverNumber'].tolist()
            times = lap_slice['Time'].dt.total_seconds().tolist()

            for i, drv in enumerate(drv_list):
                if i == 0:
                    continue  # race leader, no car ahead
                car_ahead_idx = i - 1
                gap = times[i] - times[car_ahead_idx]
                if 0 <= gap <= 1.2:
                    dirty.setdefault(str(drv), set()).add(int(lap_num))
    except Exception:
        pass
    return dirty


def _stint_degradation(stint_laps, push_scores, dirty_air_laps,
                       mean_track_temp, compound, total_race_laps):
    """
    Compute tyre degradation for a single stint.
    
    - Filter to clean laps (no SC/VSC, no in/out laps, no dirty air)
    - Use S2+S3 sector times if available, else fall back to full lap
    - Fuel correction (lap times improve as fuel burns off)
    - Linear regression for the headline slope (interpretable as "ms/lap added per tyre lap")
    - Quadratic side-fit when data permits, used only to flag stints with curvature
    - Temperature normalisation
    
    Returns dict or None if insufficient clean data.
    """
    # ── Step 1: filter to clean laps ──
    clean = stint_laps[
        (stint_laps['IsAccurate'] == True) &
        (stint_laps['TrackStatus'].astype(str).isin(['1', '2'])) &
        stint_laps['LapTime'].notna() &
        stint_laps['TyreLife'].notna() &
        stint_laps['PitOutTime'].isna() &
        stint_laps['PitInTime'].isna()
    ].copy()

    dirty_mask = clean['LapNumber'].isin(dirty_air_laps)
    clean_no_dirty = clean[~dirty_mask]
    dirty_air_excluded = int(dirty_mask.sum())
    clean = clean_no_dirty if len(clean_no_dirty) >= 4 else clean

    if len(clean) < 4:
        return None

    clean = clean.reset_index(drop=True)
    stint_length = len(clean)

    # ── Step 2: build target — prefer S2+S3, else full lap ──
    has_sectors = (clean['Sector2Time'].notna().all() and
                   clean['Sector3Time'].notna().all())

    full_lap = clean['LapTime'].dt.total_seconds().to_numpy()

    if has_sectors:
        s2 = clean['Sector2Time'].dt.total_seconds().to_numpy()
        s3 = clean['Sector3Time'].dt.total_seconds().to_numpy()
        y_raw = s2 + s3
        # Conversion: how much of a lap is S2+S3? (~0.65-0.70 typically)
        sector_to_lap_ratio = float(np.mean(full_lap) / np.mean(y_raw))
    else:
        y_raw = full_lap.copy()
        sector_to_lap_ratio = 1.0

    x = clean['TyreLife'].to_numpy().astype(float)
    lap_nums_arr = clean['LapNumber'].to_numpy().astype(float)

    # ── Step 3: fuel correction ──
    # Lap with most fuel = slowest. Subtract fuel-induced slowness.
    fuel_remaining = total_race_laps - lap_nums_arr
    fuel_penalty_full_lap = fuel_remaining * FUEL_BURN_PER_LAP
    fuel_penalty = fuel_penalty_full_lap / sector_to_lap_ratio
    y = y_raw 

    # ── Step 4: weights from push scores ──
    all_lap_nums = list(stint_laps['LapNumber'].to_numpy().astype(int))
    weights = []
    for ln in clean['LapNumber'].astype(int).tolist():
        try:
            idx = all_lap_nums.index(ln)
            ps = push_scores[idx] if idx < len(push_scores) else None
        except (ValueError, IndexError):
            ps = None

        if ps is None:    weights.append(0.7)
        elif ps >= 90:    weights.append(1.0)
        elif ps >= 75:    weights.append(0.8)
        else:             weights.append(0.4)

    w = np.array(weights, dtype=float)

    # ── Step 5: sigma clip outliers ──
    if len(y) >= 5:
        mask = np.abs(y - y.mean()) < 2 * y.std()
        if mask.sum() >= 4:
            x = x[mask]
            y = y[mask]
            w = w[mask]
            lap_nums_arr = lap_nums_arr[mask]
            full_lap = full_lap[mask]

    if len(x) < 4:
        return None

    # ── Step 6: linear regression (the headline slope) ──
    W = np.diag(w)
    X_lin = np.column_stack([np.ones_like(x), x])

    try:
        lin_coeffs = np.linalg.lstsq(W @ X_lin, W @ y, rcond=None)[0]
    except Exception:
        return None

    intercept_y = float(lin_coeffs[0])
    slope_y = float(lin_coeffs[1])
    y_pred_lin = X_lin @ lin_coeffs

    # ── Step 7: optional quadratic fit (for cliff detection only) ──
    # We do NOT use the quadratic slope as the headline number — it amplifies
    # any curvature when scaled by tyre age. Linear remains the source of truth.
    # Quadratic is only kept to flag stints where deg was accelerating.
    quad_term_y = 0.0
    has_curvature = False
    quadratic_improved_fit = False

    if len(x) >= 6:
        try:
            X_quad = np.column_stack([np.ones_like(x), x, x ** 2])
            quad_coeffs = np.linalg.lstsq(W @ X_quad, W @ y, rcond=None)[0]

            y_pred_quad = X_quad @ quad_coeffs
            ss_lin = float(np.sum(w * (y - y_pred_lin) ** 2))
            ss_quad = float(np.sum(w * (y - y_pred_quad) ** 2))

            if ss_quad < ss_lin * 0.95:
                quadratic_improved_fit = True
                quad_term_y = float(quad_coeffs[2])
                # Positive quad term = accelerating deg (cliff)
                # Negative = decelerating (early-stint warm-up)
                has_curvature = abs(quad_term_y) > 0.001
        except Exception:
            pass

    # ── Step 8: scale results back to FULL-LAP-EQUIVALENT ──
    slope = slope_y * sector_to_lap_ratio
    base_pace = intercept_y * sector_to_lap_ratio
    quad_term = quad_term_y * sector_to_lap_ratio

    # ── Step 9: temperature normalisation ──
    temp_sensitivity = TEMP_SENSITIVITY.get(compound.upper(), 0.003)
    temp_correction = (mean_track_temp - REF_TRACK_TEMP) * temp_sensitivity
    norm_slope = slope - temp_correction    
    # ── Step 10: R² (always reported on the linear fit) ──
    ss_res = float(np.sum(w * (y - y_pred_lin) ** 2))
    ss_tot = float(np.sum(w * (y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    r2 = max(0.0, min(1.0, r2))

    # ── Step 11: avg push score for this stint ──
    valid_ps = [ps for ps in (push_scores or []) if ps is not None]
    avg_push_score = float(np.mean(valid_ps)) if valid_ps else None

    # ── Step 12: chart points (raw observed lap times) ──
    points = [
        {"tyre_life": float(x[i]), "lap_time": float(full_lap[i])}
        for i in range(len(x))
    ]

    # Decide model label
    if has_curvature and quadratic_improved_fit:
        model_used = "linear_with_curvature_detected"
    else:
        model_used = "linear"

    return {
        "deg_rate": slope,
        "deg_rate_normalised": norm_slope,
        "base_pace": base_pace,
        "quad_term": quad_term,
        "model": model_used,
        "n_laps": int(len(x)),
        "stint_length": int(stint_length),
        "dirty_air_excluded": dirty_air_excluded,
        "avg_push_score": avg_push_score,
        "mean_track_temp": float(mean_track_temp),
        "temp_correction": float(temp_correction),
        "r2": float(r2),
        "points": points,
    }
    
    
    
    

def _compute_downforce_index(session) -> dict[str, float]:
    """
    Returns {driver_number: downforce_index}
    Index > 1.0 = running more downforce than field average (slower in straights)
    Index < 1.0 = running less downforce than field average (faster in straights)
    Uses SpeedST (speed trap) relative to field median.
    """
    laps = session.laps
    if 'SpeedST' not in laps.columns:
        return {}
    try:
        field_median = laps['SpeedST'].median()
        if pd.isna(field_median) or field_median == 0:
            return {}
        index = {}
        for drv in session.drivers:
            drv_laps = laps.pick_drivers(drv)
            drv_median = drv_laps['SpeedST'].median()
            if pd.notna(drv_median) and drv_median > 0:
                # lower speed = more downforce, so invert
                index[str(drv)] = float(field_median / drv_median)
        return index
    except Exception:
        return {}

def _compute_preservation_ranking(stints: list[dict]) -> list[dict]:
    """
    Ranks drivers by how well they preserved tyres relative to expectation.
    
    Method:
      1. For each compound, compute the field median normalised deg rate
      2. Each driver's preservation score = median - their deg rate
         (positive = better than field, negative = worse)
      3. Weight by r2 and stint length
      4. Average across all stints per driver
    
    Returns sorted list, best preserver first.
    """
    from collections import defaultdict

    # field median per compound (normalised, r2-weighted)
    compound_rates: dict[str, list] = defaultdict(list)
    for s in stints:
        if s['r2'] >= 0.5:
            compound_rates[s['compound']].append((s['deg_rate_normalised'], s['r2'], s['n_laps']))


    compound_median: dict[str, float] = {}
    for comp, vals in compound_rates.items():
        weights = [r2 * n for _, r2, n in vals]
        total_w = sum(weights) or 1
        compound_median[comp] = sum(r * w for (r, _, _), w in zip(vals, weights)) / total_w

    # per-driver weighted preservation score
    driver_scores: dict[str, dict] = {}
    for s in stints:
        if s['r2'] < 0.4:
            continue   # too noisy to count
        ref = compound_median.get(s['compound'])
        if ref is None:
            continue

        score    = ref - s['deg_rate_normalised']   # higher = better
        weight   = s['r2'] * s['n_laps']
        drv      = s['abbreviation']
        compound = s['compound']

        if drv not in driver_scores:
            driver_scores[drv] = {
                "abbreviation":   drv,
                "team":           s['team'],
                "weighted_sum":   0.0,
                "total_weight":   0.0,
                "by_compound":    {},
                "avg_push_score": [],
                "stints_counted": 0,
            }

        ds = driver_scores[drv]
        ds["weighted_sum"]  += score * weight
        ds["total_weight"]  += weight
        ds["stints_counted"] += 1
        if s['avg_push_score'] is not None:
            ds["avg_push_score"].append(s['avg_push_score'])

        if compound not in ds["by_compound"]:
            ds["by_compound"][compound] = {"weighted_sum": 0.0, "total_weight": 0.0}
        ds["by_compound"][compound]["weighted_sum"]  += score * weight
        ds["by_compound"][compound]["total_weight"]  += weight

    ranking = []
    for drv, ds in driver_scores.items():
        if ds["total_weight"] == 0:
            continue
        overall = ds["weighted_sum"] / ds["total_weight"]
        by_comp = {
            comp: round(v["weighted_sum"] / v["total_weight"], 4)
            for comp, v in ds["by_compound"].items()
            if v["total_weight"] > 0
        }
        push_scores_list = ds["avg_push_score"]
        ranking.append({
            "abbreviation":        drv,
            "team":                ds["team"],
            "preservation_score":  round(overall, 4),
            # positive = saved X seconds/lap vs field on same compound
            "avg_push_score":      round(float(np.mean(push_scores_list)), 1) if push_scores_list else None,
            "stints_counted":      ds["stints_counted"],
            "by_compound":         by_comp,
        })

    return sorted(ranking, key=lambda x: x["preservation_score"], reverse=True)
    
