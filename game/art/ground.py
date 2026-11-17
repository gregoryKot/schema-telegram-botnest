"""Пол: листы из столбов 16x64 (кромка и вся толща до низа кадра) — левый берег, середина, правый
берег, две сменные середины, темнота ямы. Улица — street_ground.py, дорога — road_ground.py,
комната — room.py (доски в перспективе)."""
import street_ground, road_ground

def build():
    return {'ground_street': street_ground.sheet(), 'ground_road': road_ground.sheet()}
