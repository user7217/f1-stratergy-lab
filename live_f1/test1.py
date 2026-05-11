import fastf1
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import matplotlib.pyplot as plt

fastf1.Cache.enable_cache('fastf1_cache')  

# Load session
session = fastf1.get_session(2024, 'Bahrain', 'R')
session.load()

# Pick driver
laps = session.laps.pick_drivers('VER')

# Remove bad laps
laps = laps[laps['PitOutTime'].isnull()]
laps = laps[laps['PitInTime'].isnull()]
laps = laps.pick_quicklaps()

# Convert lap time to seconds
laps['LapTime_sec'] = laps['LapTime'].dt.total_seconds()

# --- Fuel correction ---
FUEL_EFFECT = 0.035  # sec per lap (tune this per track)

laps['LapNumberInStint'] = laps.groupby('Stint').cumcount()
laps['FuelCorrected'] = laps['LapTime_sec'] - (laps['LapNumberInStint'] * FUEL_EFFECT)

# --- Analyse each stint ---
results = []

for stint_id, stint in laps.groupby('Stint'):
    if len(stint) < 5:
        continue  # too small

    X = stint['LapNumberInStint'].values.reshape(-1, 1)
    y = stint['FuelCorrected'].values

    model = LinearRegression().fit(X, y)
    slope = model.coef_[0]

    results.append({
        'stint': stint_id,
        'compound': stint['Compound'].iloc[0],
        'deg_per_lap': slope
    })

    # --- Plot ---
    plt.scatter(X, y, label=f'Stint {stint_id}')
    plt.plot(X, model.predict(X))

# Show results
df = pd.DataFrame(results)
print(df)

plt.xlabel("Lap in Stint")
plt.ylabel("Fuel Corrected Lap Time (s)")
plt.title("Tyre Degradation per Stint")
plt.legend()
plt.show()