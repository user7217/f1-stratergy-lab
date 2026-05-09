import fastf1
session = fastf1.get_session(2024, "Bahrain", "R") 
session.load()
lap = session.laps.pick_driver("VER").iloc[5]  # 6th lap
# lap = laps.pick_fastest()
print(lap.get_pos_data())