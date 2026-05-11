import asyncio
from fastapi import APIRouter, HTTPException

# USE RELATIVE IMPORTS (note the dot before aggregators)
from .aggregators import (
    _get_session_overview,
    _get_season_performance,
    _get_driver_laps,
    _get_circuit_data,
    _get_season_races,
    _get_tyre_degradation,
    _get_season_tyre_analysis
)

router = APIRouter(prefix="/api/historic")

@router.get("/{year}/{race}/overview/{session_type}")
async def historic_session_overview(year: int, race: str, session_type: str):
    loop = asyncio.get_running_loop()
    return {"data": await loop.run_in_executor(None, _get_session_overview, year, race, session_type)}

@router.get("/{year}/season-performance")
async def historic_season_performance(year: int):
    loop = asyncio.get_running_loop()
    return {"data": await loop.run_in_executor(None, _get_season_performance, year)}

@router.get("/{year}/{race}/driver/{driver}/laps")
async def historic_driver_laps(year: int, race: str, driver: str):
    loop = asyncio.get_running_loop()
    return {"data": await loop.run_in_executor(None, _get_driver_laps, year, race, driver)}

@router.get("/{year}/{race}/circuit")
async def get_circuit(year: int, race: str):
    loop = asyncio.get_running_loop()
    try:
        data = await loop.run_in_executor(None, _get_circuit_data, year, race)
    except Exception as e:
        raise HTTPException(500, f"circuit load failed: {e}")
    return {"data": data}

@router.get("/seasons/{year}/races")
async def get_season_races(year: int):
    loop = asyncio.get_running_loop()
    try:
        data = await loop.run_in_executor(None, _get_season_races, year)
    except Exception as e:
        raise HTTPException(500, f"schedule load failed: {e}")
    return {"data": data}   

@router.get("/{year}/{race}/tyre-degradation")
async def tyre_degradation(year: int, race: str):
    loop = asyncio.get_running_loop()
    try:
        return {"data": await loop.run_in_executor(None, _get_tyre_degradation, year, race, True)}
    except Exception as e:
        raise HTTPException(500, f"tyre deg failed: {e}")

@router.get("/{year}/season-tyre-analysis")
async def season_tyre_analysis(year: int):
    loop = asyncio.get_running_loop()
    try:
        return {"data": await loop.run_in_executor(None, _get_season_tyre_analysis, year)}
    except Exception as e:
        raise HTTPException(500, f"season tyre analysis failed: {e}")