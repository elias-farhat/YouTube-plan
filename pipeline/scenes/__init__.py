from .common import Kinetic, Stat
from .history import MapScene
from .money import BarChart, LineChart
from .space import LightBeam, LightScale, Orbit, Sizes

REGISTRY = {
    "money": {"kinetic": Kinetic, "stat": Stat, "line": LineChart, "bar": BarChart},
    "space": {"kinetic": Kinetic, "stat": Stat, "lightbeam": LightBeam, "lightscale": LightScale,
              "orbit": Orbit, "sizes": Sizes},
    "history": {"kinetic": Kinetic, "stat": Stat, "map": MapScene, "route": MapScene},
}


def available(channel):
    return sorted(REGISTRY[channel])
